import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { accesoDe, planDe, tiene, type Plan } from "../shared/planes";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { hashToken } from "./supabaseAuth";

const MCP_PROTOCOL_VERSION = "2025-06-18";
const MAX_ROWS = 100;

type WorkerKind = "employee" | "subcontractor";

export type WorkerIdentity = {
  workerId: string;
  workerKind: WorkerKind;
  businessId: string;
  name: string | null;
  workerRole: string | null;
  plan: Plan;
  access: "activo" | "prueba" | "bloqueado";
};

type ReadToolContext = {
  identity: WorkerIdentity;
  requestId: string;
};

function bearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

function jsonResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  };
}

function errorResult(message: string, code: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message, code }) }],
  };
}

async function resolveWorkerFromOAuthToken(token: string): Promise<WorkerIdentity | null> {
  const admin = getSupabaseAdmin();
  const { data: oauth, error: oauthError } = await admin
    .from("mcp_oauth_tokens")
    .select("connection_id, scope, resource, access_expires_at, revoked_at, mcp_connections(business_id, employee_id, subcontractor_id, status)")
    .eq("access_token_hash", hashToken(token))
    .maybeSingle();
  if (oauthError) {
    // Before the OAuth migration is applied, preserve the original worker-token
    // flow rather than turning every MCP request into a generic 500.
    if (oauthError.code === "42P01" || oauthError.code === "PGRST205") return null;
    throw oauthError;
  }
  if (!oauth || oauth.revoked_at || new Date(oauth.access_expires_at).getTime() <= Date.now()) return null;
  if (oauth.resource !== `${process.env.MCP_OAUTH_ISSUER?.trim().replace(/\/$/, "") || ""}/mcp` && process.env.MCP_OAUTH_ISSUER) return null;
  const connection = oauth.mcp_connections as unknown as { business_id: string; employee_id: string | null; subcontractor_id: string | null; status: string } | null;
  if (!connection || connection.status !== "active" || oauth.scope !== "mcp:read") return null;
  const id = connection.employee_id ?? connection.subcontractor_id;
  if (!id) return null;
  const table = connection.employee_id ? "employees" : "subcontractors";
  const select = connection.employee_id
    ? "id, business_id, name, role, businesses(subscription_plan, subscription_status, trial_ends_at)"
    : "id, business_id, name, trade, businesses(subscription_plan, subscription_status, trial_ends_at)";
  const { data: row, error } = await admin.from(table).select(select).eq("id", id).eq("business_id", connection.business_id).maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const business = (row as any).businesses as { subscription_plan?: string | null; subscription_status?: string | null; trial_ends_at?: string | null } | null;
  const plan = planDe(business?.subscription_plan);
  return {
    workerId: row.id,
    workerKind: connection.employee_id ? "employee" : "subcontractor",
    businessId: row.business_id,
    name: row.name ?? null,
    workerRole: connection.employee_id ? (row as any).role ?? null : (row as any).trade ?? null,
    plan,
    access: accesoDe({ plan, estadoSuscripcion: business?.subscription_status ?? null, pruebaHasta: business?.trial_ends_at ?? null }),
  };
}

export async function resolveWorker(token: string): Promise<WorkerIdentity | null> {
  const admin = getSupabaseAdmin();
  const hash = hashToken(token);
  const [employee, subcontractor] = await Promise.all([
    admin
      .from("employees")
      .select("id, business_id, name, role, status, businesses(subscription_plan, subscription_status, trial_ends_at)")
      .eq("access_token_hash", hash)
      .maybeSingle(),
    admin
      .from("subcontractors")
      .select("id, business_id, name, trade, businesses(subscription_plan, subscription_status, trial_ends_at)")
      .eq("access_token_hash", hash)
      .maybeSingle(),
  ]);

  if (employee.error && subcontractor.error) {
    const oauthIdentity = await resolveWorkerFromOAuthToken(token);
    if (oauthIdentity) return oauthIdentity;
    throw new Error("Worker directory unavailable");
  }
  const row = employee.data ?? subcontractor.data;
  if (!row) return (await resolveWorkerFromOAuthToken(token));

  const workerKind: WorkerKind = employee.data ? "employee" : "subcontractor";
  const business = (row as any).businesses as {
    subscription_plan?: string | null;
    subscription_status?: string | null;
    trial_ends_at?: string | null;
  } | null;
  const plan = planDe(business?.subscription_plan);
  const access = accesoDe({
    plan,
    estadoSuscripcion: business?.subscription_status ?? null,
    pruebaHasta: business?.trial_ends_at ?? null,
  });

  return {
    workerId: row.id,
    workerKind,
    businessId: row.business_id,
    name: row.name ?? null,
    workerRole: workerKind === "employee" ? (row as any).role ?? null : (row as any).trade ?? null,
    plan,
    access,
  };
}

async function audit(context: ReadToolContext, toolName: string, allowed: boolean, detail?: unknown) {
  const admin = getSupabaseAdmin();
  const column = context.identity.workerKind === "employee" ? "employee_id" : "subcontractor_id";
  const { error } = await admin.from("mcp_audit_log").insert({
    request_id: context.requestId,
    business_id: context.identity.businessId,
    [column]: context.identity.workerId,
    tool_name: toolName,
    allowed,
    detail: detail ?? null,
  });
  if (error) console.error("[mcp] audit write failed", error);
}

function requireReadable(context: ReadToolContext, toolName: string) {
  if (context.identity.access === "bloqueado") {
    return errorResult("El negocio no tiene acceso operativo activo.", "business_access_blocked");
  }
  if (!tiene(context.identity.plan, "campo")) {
    return errorResult("Esta herramienta no está incluida en el plan del negocio.", "plan_capability_required");
  }
  return null;
}

function dateRange(date: string | undefined, timezoneOffsetMinutes: number | undefined) {
  const offset = Number.isFinite(timezoneOffsetMinutes) && Math.abs(timezoneOffsetMinutes ?? 0) <= 840
    ? timezoneOffsetMinutes ?? 0
    : 0;
  const base = date ? new Date(`${date}T12:00:00.000Z`) : new Date();
  const local = new Date(base.getTime() - offset * 60_000);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return {
    from: new Date(midnight + offset * 60_000).toISOString(),
    to: new Date(midnight + 86_400_000 + offset * 60_000).toISOString(),
    date: new Date(midnight).toISOString().slice(0, 10),
  };
}

function createMcpServer(context: ReadToolContext) {
  const server = new McpServer({ name: "field-construction", version: "0.1.0" });
  const admin = getSupabaseAdmin();
  const assignedColumn = context.identity.workerKind === "employee" ? "assigned_employee_id" : "assigned_subcontractor_id";
  const workerColumn = context.identity.workerKind === "employee" ? "employee_id" : "subcontractor_id";

  server.registerTool(
    "get_my_schedule",
    {
      title: "Mon horaire",
      description: "Consulte les événements et ordres de travail du travailleur pour une date donnée.",
      inputSchema: {
        date: z.string().optional().describe("Date locale au format YYYY-MM-DD"),
        timezoneOffsetMinutes: z.number().optional().describe("Décalage local en minutes par rapport à UTC"),
      },
    },
    async ({ date, timezoneOffsetMinutes }) => {
      const denied = requireReadable(context, "get_my_schedule");
      if (denied) {
        await audit(context, "get_my_schedule", false, { code: "access_denied" });
        return denied;
      }
      const range = dateRange(date, timezoneOffsetMinutes);
      const [events, orders] = await Promise.all([
        admin
          .from("schedule_events")
          .select("id, title, start_time, end_time, type, notes, service_type, commessa, projects(id, name, status)")
          .eq("business_id", context.identity.businessId)
          .eq(assignedColumn, context.identity.workerId)
          .gte("start_time", range.from)
          .lt("start_time", range.to)
          .order("start_time")
          .limit(MAX_ROWS),
        admin
          .from("work_orders")
          .select("id, title, description, priority, status, service_type, scheduled_start, duration_minutes, commessa, projects(id, name, status)")
          .eq("business_id", context.identity.businessId)
          .eq(assignedColumn, context.identity.workerId)
          .gte("scheduled_start", range.from)
          .lt("scheduled_start", range.to)
          .order("scheduled_start")
          .limit(MAX_ROWS),
      ]);
      if (events.error) throw events.error;
      if (orders.error) throw orders.error;
      const result = { date: range.date, events: events.data ?? [], workOrders: orders.data ?? [] };
      await audit(context, "get_my_schedule", true, { date: range.date, counts: { events: result.events.length, workOrders: result.workOrders.length } });
      return jsonResult(result);
    },
  );

  server.registerTool(
    "get_my_work_orders",
    {
      title: "Mes ordres de travail",
      description: "Consulte les ordres de travail attribués à ce travailleur.",
      inputSchema: { status: z.string().optional().describe("Filtrer par statut Field") },
    },
    async ({ status }) => {
      const denied = requireReadable(context, "get_my_work_orders");
      if (denied) {
        await audit(context, "get_my_work_orders", false, { code: "access_denied" });
        return denied;
      }
      let query = admin
        .from("work_orders")
        .select("id, title, description, priority, status, service_type, scheduled_start, duration_minutes, commessa, projects(id, name, status)")
        .eq("business_id", context.identity.businessId)
        .eq(assignedColumn, context.identity.workerId)
        .order("scheduled_start", { ascending: false })
        .limit(MAX_ROWS);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      await audit(context, "get_my_work_orders", true, { count: data?.length ?? 0 });
      return jsonResult({ workOrders: data ?? [] });
    },
  );

  server.registerTool(
    "get_my_projects",
    {
      title: "Mes projets",
      description: "Consulte les projets auxquels ce travailleur est rattaché par affectation, agenda ou ordre de travail.",
      inputSchema: {},
    },
    async () => {
      const denied = requireReadable(context, "get_my_projects");
      if (denied) {
        await audit(context, "get_my_projects", false, { code: "access_denied" });
        return denied;
      }
      const [assignments, events, orders] = await Promise.all([
        admin.from("assignments").select("projects(id, name, status, progress_percent, start_date, end_date)").eq("business_id", context.identity.businessId).eq(workerColumn, context.identity.workerId).limit(MAX_ROWS),
        admin.from("schedule_events").select("projects(id, name, status, progress_percent, start_date, end_date)").eq("business_id", context.identity.businessId).eq(assignedColumn, context.identity.workerId).limit(MAX_ROWS),
        admin.from("work_orders").select("projects(id, name, status, progress_percent, start_date, end_date)").eq("business_id", context.identity.businessId).eq(assignedColumn, context.identity.workerId).limit(MAX_ROWS),
      ]);
      if (assignments.error) throw assignments.error;
      if (events.error) throw events.error;
      if (orders.error) throw orders.error;
      const projects = new Map<string, unknown>();
      for (const source of [assignments.data, events.data, orders.data]) {
        for (const row of source ?? []) {
          const project = (row as any).projects;
          if (project?.id) projects.set(project.id, project);
        }
      }
      const result = Array.from(projects.values());
      await audit(context, "get_my_projects", true, { count: result.length });
      return jsonResult({ projects: result });
    },
  );

  server.registerTool(
    "get_my_tasks",
    {
      title: "Mes tâches",
      description: "Consulte les tâches de travail attribuées à ce travailleur.",
      inputSchema: { includeCompleted: z.boolean().optional().describe("Inclure les ordres terminés") },
    },
    async ({ includeCompleted }) => {
      const denied = requireReadable(context, "get_my_tasks");
      if (denied) {
        await audit(context, "get_my_tasks", false, { code: "access_denied" });
        return denied;
      }
      let query = admin
        .from("work_orders")
        .select("id, title, description, status, priority, scheduled_start, duration_minutes, service_type, projects(id, name, status)")
        .eq("business_id", context.identity.businessId)
        .eq(assignedColumn, context.identity.workerId)
        .order("scheduled_start", { ascending: true })
        .limit(MAX_ROWS);
      if (!includeCompleted) query = query.neq("status", "completada");
      const { data, error } = await query;
      if (error) throw error;
      await audit(context, "get_my_tasks", true, { count: data?.length ?? 0 });
      return jsonResult({ tasks: data ?? [] });
    },
  );

  server.registerTool(
    "get_my_time_entries",
    {
      title: "Mes heures",
      description: "Consulte les heures enregistrées par ce travailleur, sans modifier les fichages.",
      inputSchema: { from: z.string().optional().describe("Date de début ISO"), to: z.string().optional().describe("Date de fin ISO") },
    },
    async ({ from, to }) => {
      const denied = requireReadable(context, "get_my_time_entries");
      if (denied) {
        await audit(context, "get_my_time_entries", false, { code: "access_denied" });
        return denied;
      }
      let query = admin
        .from("time_entries")
        .select("id, project_id, projects(name), check_in_time, check_out_time, check_in_location, check_out_location, billable, service_type, overtime, approved")
        .eq("business_id", context.identity.businessId)
        .eq(workerColumn, context.identity.workerId)
        .order("check_in_time", { ascending: false })
        .limit(MAX_ROWS);
      if (from) query = query.gte("check_in_time", from);
      if (to) query = query.lt("check_in_time", to);
      const { data, error } = await query;
      if (error) throw error;
      await audit(context, "get_my_time_entries", true, { count: data?.length ?? 0 });
      return jsonResult({ timeEntries: data ?? [] });
    },
  );

  server.registerTool(
    "get_my_documents",
    {
      title: "Mes documents",
      description: "Consulte les documents explicitement rendus visibles à ce travailleur.",
      inputSchema: {},
    },
    async () => {
      const denied = requireReadable(context, "get_my_documents");
      if (denied) {
        await audit(context, "get_my_documents", false, { code: "access_denied" });
        return denied;
      }
      const { data, error } = await admin
        .from("worker_documents")
        .select("id, kind, name, year, note, uploaded_at, visible_to_worker")
        .eq("business_id", context.identity.businessId)
        .eq(workerColumn, context.identity.workerId)
        .eq("visible_to_worker", true)
        .order("uploaded_at", { ascending: false })
        .limit(MAX_ROWS);
      if (error) throw error;
      await audit(context, "get_my_documents", true, { count: data?.length ?? 0 });
      return jsonResult({ documents: data ?? [] });
    },
  );

  return server;
}

export function mcpHandler(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) {
    const scheme = req.protocol;
    const metadata = `${scheme}://${req.get("host")}/api/.well-known/oauth-protected-resource/mcp`;
    res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${metadata}"`);
    res.status(401).json({ error: "Missing worker bearer token", code: "missing_token" });
    return;
  }

  resolveWorker(token)
    .then(async (identity) => {
      if (!identity) {
        const metadata = `${req.protocol}://${req.get("host")}/api/.well-known/oauth-protected-resource/mcp`;
        res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${metadata}"`);
        res.status(401).json({ error: "Invalid or expired worker token", code: "invalid_worker_token" });
        return;
      }
      if (identity.access === "bloqueado") {
        res.status(403).json({ error: "Business access is blocked", code: "business_access_blocked" });
        return;
      }
      const context: ReadToolContext = { identity, requestId: req.header("x-request-id") ?? randomUUID() };
      const mcp = createMcpServer(context);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcp.connect(transport);
      await transport.handleRequest(req, res, req.body);
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message.includes("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")) {
        res.status(503).json({ error: "Worker directory unavailable", code: "backend_unavailable" });
        return;
      }
      next(error);
    });
}

export const MCP_PROTOCOL = MCP_PROTOCOL_VERSION;
