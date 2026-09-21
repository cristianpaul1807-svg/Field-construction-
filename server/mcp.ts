import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { accesoDe, planDe, tiene, type Plan } from "../shared/planes";
import { type Area } from "../shared/permisos";
import { puedeUsarHerramienta, TOOL_ACCESS } from "../shared/mcpRoles";
import { areasDelRol } from "./supabaseAuth";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { hashToken } from "./supabaseAuth";
import { profitabilityByProject } from "./profitability";
import { receivables } from "./receivables";

const MCP_PROTOCOL_VERSION = "2025-06-18";
const MAX_ROWS = 100;

type WorkerKind = "employee" | "subcontractor" | "owner";

export type WorkerIdentity = {
  workerId: string;
  workerKind: WorkerKind;
  businessId: string;
  name: string | null;
  workerRole: string | null;
  /**
   * Las áreas del panel de esta persona, o `null` si las ve todas.
   *
   * Es **el mismo dato** que decide qué pantallas se le abren en el panel, y
   * viaja hasta aquí para que MCP no tenga que adivinarlo del nombre del rol.
   * Ver `roleOf()`, que explica por qué adivinarlo era un agujero.
   */
  areas: Area[] | null;
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

/**
 * Quién es este usuario de cuenta dentro de su negocio.
 *
 * **Una sola función, y la usan los dos lados**: el formulario de
 * consentimiento cuando alguien teclea su correo y su contraseña, y la
 * resolución del token en cada llamada de Claude. Antes eran dos reglas
 * distintas, y no coincidían:
 *
 * - al autorizar se aceptaba al propietario principal **o** a cualquier
 *   usuario activo del negocio;
 * - al usar el token se exigía `businesses.primary_auth_user_id`.
 *
 * El resultado era que un segundo administrador pasaba el consentimiento,
 * recibía su código, canjeaba su token… y entonces **cada** llamada resolvía
 * `null` y devolvía 401. Claude lo interpreta como token caducado, refresca, y
 * vuelve a empezar: 27 tokens emitidos y 25 revocados en 45 minutos, todos de
 * la misma persona. Desde fuera se ve como «Logiciel no responde», que es
 * exactamente el síntoma que no lleva a la causa.
 *
 * Lo que valida un acceso tiene que ser lo mismo que lo concedió. Si hay dos
 * sitios, un día divergen — y el día que divergen nadie mira aquí.
 *
 * ## Qué rol recibe
 *
 * El propietario principal, `admin`. Cualquier otro usuario del negocio, **el
 * suyo** — y sin rol asignado también `admin`, porque es lo que significa en
 * el panel: `shared/permisos.ts` trata `areas === null` como «sin límite», y
 * quien lleva el negocio no tiene rol. Traducir «sin rol» por `tecnico`, como
 * se hacía, le daba en Claude *menos* de lo que ya ve en su pantalla.
 *
 * Y eso es la regla permanente del plan maestro leída en su otra dirección:
 * una conexión MCP no puede ampliar lo que la persona ya puede ver, pero
 * tampoco tiene por qué recortarlo. Igual, no más.
 */
export async function resolveOwnerIdentity(
  authUserId: string,
  businessId?: string,
): Promise<WorkerIdentity | null> {
  const admin = getSupabaseAdmin();
  const columnas = "id, name, subscription_plan, subscription_status, trial_ends_at";

  const construir = (
    negocio: { id: string; name?: string | null; subscription_plan?: string | null; subscription_status?: string | null; trial_ends_at?: string | null },
    rol: string,
    areas: Area[] | null,
  ): WorkerIdentity => {
    const plan = planDe(negocio.subscription_plan);
    return {
      workerId: authUserId,
      workerKind: "owner",
      businessId: negocio.id,
      name: negocio.name ?? null,
      workerRole: rol,
      areas,
      plan,
      access: accesoDe({
        plan,
        estadoSuscripcion: negocio.subscription_status ?? null,
        pruebaHasta: negocio.trial_ends_at ?? null,
      }),
    };
  };

  // El propietario principal: quien creó la cuenta.
  let propietario = admin.from("businesses").select(columnas).eq("primary_auth_user_id", authUserId);
  if (businessId) propietario = propietario.eq("id", businessId);
  const { data: suyo, error: errorPropietario } = await propietario.maybeSingle();
  if (errorPropietario) throw errorPropietario;
  if (suyo) {
    // Incluso el propietario principal pasa por su fila de `users`: si alguien
    // le puso un rol con áreas, en el panel se le aplica, y aquí también. Sin
    // fila —cuentas de antes de que existiera— se queda en `null`, que es lo
    // que el panel entiende por «sin límite».
    const { data: fila } = await admin
      .from("users")
      .select("roles(permissions)")
      .eq("auth_user_id", authUserId)
      .eq("business_id", suyo.id)
      .limit(1)
      .maybeSingle();
    return construir(suyo, "admin", areasDelRol((fila as { roles?: { permissions?: unknown } | null } | null)?.roles));
  }

  // Y si no, un usuario del negocio. Las cuentas antiguas no tienen
  // `primary_auth_user_id` puesto, así que este camino no es sólo para los
  // administradores segundos: es también el único que tienen los negocios que
  // existían antes de esa columna.
  let usuario = admin
    .from("users")
    .select("business_id, roles(name, permissions)")
    .eq("auth_user_id", authUserId)
    .eq("status", "activo");
  if (businessId) usuario = usuario.eq("business_id", businessId);
  const { data: fila, error: errorUsuario } = await usuario.limit(1).maybeSingle();
  if (errorUsuario) throw errorUsuario;
  if (!fila?.business_id) return null;

  const { data: negocio, error: errorNegocio } = await admin
    .from("businesses")
    .select(columnas)
    .eq("id", fila.business_id)
    .maybeSingle();
  if (errorNegocio) throw errorNegocio;
  if (!negocio) return null;

  const rolDelUsuario = (fila as { roles?: { name?: string; permissions?: unknown } | null }).roles;
  return construir(negocio, rolDelUsuario?.name ?? "admin", areasDelRol(rolDelUsuario));
}

async function resolveWorkerFromOAuthToken(token: string): Promise<WorkerIdentity | null> {
  const admin = getSupabaseAdmin();
  const { data: oauth, error: oauthError } = await admin
    .from("mcp_oauth_tokens")
    .select("connection_id, scope, resource, access_expires_at, revoked_at, mcp_connections(business_id, employee_id, subcontractor_id, owner_auth_user_id, status)")
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
  const connection = oauth.mcp_connections as unknown as { business_id: string; employee_id: string | null; subcontractor_id: string | null; owner_auth_user_id: string | null; status: string } | null;
  if (!connection || connection.status !== "active" || oauth.scope !== "mcp:read") return null;
  const id = connection.employee_id ?? connection.subcontractor_id ?? connection.owner_auth_user_id;
  if (!id) return null;
  if (connection.owner_auth_user_id) {
    // La **misma** función que usó el formulario de consentimiento para dejarle
    // entrar. Ver `resolveOwnerIdentity`: que aquí se comprobara otra cosa es
    // lo que tenía a Claude dando vueltas.
    return resolveOwnerIdentity(connection.owner_auth_user_id, connection.business_id);
  }
  const table = connection.employee_id ? "employees" : "subcontractors";
  const select = connection.employee_id
    ? "id, business_id, name, role, roles(name, permissions), businesses(subscription_plan, subscription_status, trial_ends_at)"
    : "id, business_id, name, trade, roles(name, permissions), businesses(subscription_plan, subscription_status, trial_ends_at)";
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
    workerRole: (row as any).roles?.name ?? (connection.employee_id ? (row as any).role ?? null : (row as any).trade ?? null),
    areas: areasDelRol((row as any).roles),
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
      .select("id, business_id, name, role, role_id, status, roles(name, permissions), businesses(subscription_plan, subscription_status, trial_ends_at)")
      .eq("access_token_hash", hash)
      .maybeSingle(),
    admin
      .from("subcontractors")
      .select("id, business_id, name, trade, role_id, roles(name, permissions), businesses(subscription_plan, subscription_status, trial_ends_at)")
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
    workerRole: (row as any).roles?.name ?? (workerKind === "employee" ? (row as any).role ?? null : (row as any).trade ?? null),
    areas: areasDelRol((row as any).roles),
    plan,
    access,
  };
}

async function audit(context: ReadToolContext, toolName: string, allowed: boolean, detail?: unknown) {
  const admin = getSupabaseAdmin();
  const column = context.identity.workerKind === "employee" ? "employee_id" : context.identity.workerKind === "subcontractor" ? "subcontractor_id" : "owner_auth_user_id";
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

/**
 * El guardia de cada herramienta, con la misma tabla que el listado.
 *
 * Esconder una herramienta de `tools/list` no es protegerla: nada impide
 * llamarla por su nombre. Esto es lo que la protege de verdad, y lee
 * exactamente lo mismo que decidió esconderla.
 */
function requireRole(context: ReadToolContext, toolName: string) {
  const readable = requireReadable(context, toolName);
  if (readable) return readable;
  const access = TOOL_ACCESS[toolName];
  if (!access) {
    // Una herramienta que nadie clasificó se niega. El error seguro, no el
    // silencioso: `scripts/check-mcp-readonly.py` existe para que no llegue.
    return errorResult("Esta herramienta no está disponible para el rol MCP autenticado.", "mcp_role_required");
  }
  if (!puedeUsarHerramienta(context.identity, toolName)) {
    return errorResult("Esta herramienta no está disponible para el rol MCP autenticado.", "mcp_role_required");
  }
  if (!tiene(context.identity.plan, access.capability)) {
    return errorResult("Esta herramienta no está incluida en el plan del negocio.", "plan_capability_required");
  }
  return null;
}

function toolIsVisible(context: ReadToolContext, toolName: string) {
  if (!tiene(context.identity.plan, "campo")) return false;
  // Lo suyo: su agenda, sus horas, sus papeles. No hay área que comprobar
  // porque no está viendo el negocio, se está viendo a sí mismo.
  if (toolName.startsWith("get_my_")) return true;
  const access = TOOL_ACCESS[toolName];
  if (!access) return false;
  return puedeUsarHerramienta(context.identity, toolName) && tiene(context.identity.plan, access.capability);
}

async function managedProjectIds(admin: ReturnType<typeof getSupabaseAdmin>, context: ReadToolContext) {
  if (context.identity.workerKind === "owner") {
    const { data, error } = await admin.from("projects").select("id").eq("business_id", context.identity.businessId).limit(MAX_ROWS);
    if (error) throw error;
    return (data ?? []).map((row) => row.id);
  }
  const workerColumn = context.identity.workerKind === "employee" ? "employee_id" : "subcontractor_id";
  const assignedColumn = context.identity.workerKind === "employee" ? "assigned_employee_id" : "assigned_subcontractor_id";
  const [assignments, events, orders] = await Promise.all([
    admin.from("assignments").select("project_id").eq("business_id", context.identity.businessId).eq(workerColumn, context.identity.workerId).limit(MAX_ROWS),
    admin.from("schedule_events").select("project_id").eq("business_id", context.identity.businessId).eq(assignedColumn, context.identity.workerId).limit(MAX_ROWS),
    admin.from("work_orders").select("project_id").eq("business_id", context.identity.businessId).eq(assignedColumn, context.identity.workerId).limit(MAX_ROWS),
  ]);
  if (assignments.error) throw assignments.error;
  if (events.error) throw events.error;
  if (orders.error) throw orders.error;
  return Array.from(new Set([...(assignments.data ?? []), ...(events.data ?? []), ...(orders.data ?? [])].map((row) => row.project_id).filter(Boolean)));
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
  // The MCP client builds its menu from tools/list. Do not register tools the
  // identity cannot use; handler-level guards remain as a second security wall.
  const originalRegisterTool = server.registerTool.bind(server);
  (server as any).registerTool = (name: string, config: unknown, handler: unknown) => {
    if (!toolIsVisible(context, name)) return undefined;
    return originalRegisterTool(name as never, config as never, handler as never);
  };
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

  server.registerTool(
    "get_projects",
    {
      title: "Projets de mon périmètre",
      description: "Consulte les projets opérationnels auxquels un chef de chantier ou une personne de bureau est rattaché.",
      inputSchema: {},
    },
    async () => {
      const denied = requireRole(context, "get_projects");
      if (denied) {
        await audit(context, "get_projects", false, { code: "access_denied" });
        return denied;
      }
      const ids = await managedProjectIds(admin, context);
      if (!ids.length) {
        await audit(context, "get_projects", true, { count: 0 });
        return jsonResult({ projects: [] });
      }
      const { data, error } = await admin
        .from("projects")
        .select("id, code, name, status, progress_percent, start_date, end_date, address, client_id, clients(name)")
        .eq("business_id", context.identity.businessId)
        .in("id", ids)
        .order("start_date", { ascending: false })
        .limit(MAX_ROWS);
      if (error) throw error;
      await audit(context, "get_projects", true, { count: data?.length ?? 0 });
      return jsonResult({ projects: data ?? [] });
    },
  );

  server.registerTool(
    "get_project",
    {
      title: "Détail du projet",
      description: "Consulta el detalle de un proyecto dentro del perímetro operativo del encargado.",
      inputSchema: { projectId: z.string().uuid().describe("Identificador del proyecto") },
    },
    async ({ projectId }) => {
      const denied = requireRole(context, "get_project");
      if (denied) {
        await audit(context, "get_project", false, { code: "access_denied" });
        return denied;
      }
      const ids = await managedProjectIds(admin, context);
      if (!ids.includes(projectId)) {
        await audit(context, "get_project", false, { code: "project_out_of_scope" });
        return errorResult("El proyecto no está dentro del perímetro autorizado.", "project_out_of_scope");
      }
      const { data, error } = await admin
        .from("projects")
        .select("id, code, name, type, status, progress_percent, start_date, end_date, address, client_id, clients(name, email)")
        .eq("business_id", context.identity.businessId)
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return errorResult("Proyecto no encontrado.", "project_not_found");
      await audit(context, "get_project", true, { projectId });
      return jsonResult({ project: data });
    },
  );

  server.registerTool(
    "get_project_schedule",
    {
      title: "Agenda del proyecto",
      description: "Consulta eventos y órdenes planificadas de un proyecto autorizado.",
      inputSchema: { projectId: z.string().uuid().describe("Identificador del proyecto") },
    },
    async ({ projectId }) => {
      const denied = requireRole(context, "get_project_schedule");
      if (denied) {
        await audit(context, "get_project_schedule", false, { code: "access_denied" });
        return denied;
      }
      const ids = await managedProjectIds(admin, context);
      if (!ids.includes(projectId)) return errorResult("El proyecto no está dentro del perímetro autorizado.", "project_out_of_scope");
      const [events, orders] = await Promise.all([
        admin.from("schedule_events").select("id, title, start_time, end_time, type, notes, service_type, assigned_employee_id, assigned_subcontractor_id").eq("business_id", context.identity.businessId).eq("project_id", projectId).order("start_time").limit(MAX_ROWS),
        admin.from("work_orders").select("id, title, description, priority, status, scheduled_start, duration_minutes, service_type, assigned_employee_id, assigned_subcontractor_id").eq("business_id", context.identity.businessId).eq("project_id", projectId).order("scheduled_start").limit(MAX_ROWS),
      ]);
      if (events.error) throw events.error;
      if (orders.error) throw orders.error;
      await audit(context, "get_project_schedule", true, { projectId, events: events.data?.length ?? 0, workOrders: orders.data?.length ?? 0 });
      return jsonResult({ projectId, events: events.data ?? [], workOrders: orders.data ?? [] });
    },
  );

  server.registerTool(
    "get_work_orders",
    {
      title: "Órdenes de mi perímetro",
      description: "Consulta las órdenes de trabajo de los proyectos autorizados, sin modificarlas.",
      inputSchema: { status: z.string().optional().describe("Filtrar por estado Field") },
    },
    async ({ status }) => {
      const denied = requireRole(context, "get_work_orders");
      if (denied) {
        await audit(context, "get_work_orders", false, { code: "access_denied" });
        return denied;
      }
      const ids = await managedProjectIds(admin, context);
      if (!ids.length) return jsonResult({ workOrders: [] });
      let query = admin.from("work_orders").select("id, project_id, title, description, priority, status, scheduled_start, duration_minutes, service_type, assigned_employee_id, assigned_subcontractor_id, projects(name)").eq("business_id", context.identity.businessId).in("project_id", ids).order("scheduled_start", { ascending: false }).limit(MAX_ROWS);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      await audit(context, "get_work_orders", true, { count: data?.length ?? 0 });
      return jsonResult({ workOrders: data ?? [] });
    },
  );

  server.registerTool(
    "get_workers",
    {
      title: "Équipe de mon périmètre",
      description: "Consulta los empleados y subcontratistas vinculados a los proyectos autorizados, sin salarios ni datos sensibles.",
      inputSchema: {},
    },
    async () => {
      const denied = requireRole(context, "get_workers");
      if (denied) {
        await audit(context, "get_workers", false, { code: "access_denied" });
        return denied;
      }
      const ids = await managedProjectIds(admin, context);
      if (!ids.length) return jsonResult({ workers: [] });
      const [assignments, events, orders] = await Promise.all([
        admin.from("assignments").select("employee_id, subcontractor_id").eq("business_id", context.identity.businessId).in("project_id", ids).limit(MAX_ROWS),
        admin.from("schedule_events").select("assigned_employee_id, assigned_subcontractor_id").eq("business_id", context.identity.businessId).in("project_id", ids).limit(MAX_ROWS),
        admin.from("work_orders").select("assigned_employee_id, assigned_subcontractor_id").eq("business_id", context.identity.businessId).in("project_id", ids).limit(MAX_ROWS),
      ]);
      if (assignments.error) throw assignments.error;
      if (events.error) throw events.error;
      if (orders.error) throw orders.error;
      const employeeIds = new Set<string>();
      const subcontractorIds = new Set<string>();
      for (const row of [...(assignments.data ?? []), ...(events.data ?? []), ...(orders.data ?? [])] as any[]) {
        if (row.employee_id || row.assigned_employee_id) employeeIds.add(row.employee_id ?? row.assigned_employee_id);
        if (row.subcontractor_id || row.assigned_subcontractor_id) subcontractorIds.add(row.subcontractor_id ?? row.assigned_subcontractor_id);
      }
      const [employees, subcontractors] = await Promise.all([
        employeeIds.size ? admin.from("employees").select("id, name, role, status").eq("business_id", context.identity.businessId).in("id", Array.from(employeeIds)).limit(MAX_ROWS) : Promise.resolve({ data: [], error: null }),
        subcontractorIds.size ? admin.from("subcontractors").select("id, name, trade, status").eq("business_id", context.identity.businessId).in("id", Array.from(subcontractorIds)).limit(MAX_ROWS) : Promise.resolve({ data: [], error: null }),
      ]);
      if (employees.error) throw employees.error;
      if (subcontractors.error) throw subcontractors.error;
      const workers = [
        ...(employees.data ?? []).map((row: any) => ({ id: row.id, kind: "employee", name: row.name, role: row.role, status: row.status })),
        ...(subcontractors.data ?? []).map((row: any) => ({ id: row.id, kind: "subcontractor", name: row.name, trade: row.trade, status: row.status })),
      ];
      await audit(context, "get_workers", true, { count: workers.length });
      return jsonResult({ workers });
    },
  );

  server.registerTool(
    "get_business_summary",
    {
      title: "Resumen de la empresa",
      description: "Devuelve un resumen agregado de la empresa para roles de administración, oficina o contabilidad.",
      inputSchema: {},
    },
    async () => {
      const denied = requireRole(context, "get_business_summary");
      if (denied) {
        await audit(context, "get_business_summary", false, { code: "access_denied" });
        return denied;
      }
      const businessId = context.identity.businessId;
      const [projects, delayedProjects, employees, subcontractors, workOrders, receivableReport] = await Promise.all([
        admin.from("projects").select("id", { count: "exact", head: true }).eq("business_id", businessId),
        admin.from("projects").select("id", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["retrasada", "atrasada", "delayed"]),
        admin.from("employees").select("id", { count: "exact", head: true }).eq("business_id", businessId),
        admin.from("subcontractors").select("id", { count: "exact", head: true }).eq("business_id", businessId),
        admin.from("work_orders").select("id", { count: "exact", head: true }).eq("business_id", businessId).neq("status", "completada"),
        receivables(admin, businessId),
      ]);
      for (const result of [projects, delayedProjects, employees, subcontractors, workOrders]) if (result.error) throw result.error;
      const result = {
        projectsActive: projects.count ?? 0,
        projectsDelayed: delayedProjects.count ?? 0,
        invoicesPending: receivableReport.invoices.length,
        receivables: receivableReport.total,
        workers: (employees.count ?? 0) + (subcontractors.count ?? 0),
        openWorkOrders: workOrders.count ?? 0,
      };
      await audit(context, "get_business_summary", true, result);
      return jsonResult(result);
    },
  );

  server.registerTool(
    "get_invoices",
    {
      title: "Factures",
      description: "Consulta facturas del negocio sin crearlas, modificarlas ni enviarlas.",
      inputSchema: { status: z.string().optional().describe("Filtrar por estado de factura") },
    },
    async ({ status }) => {
      const denied = requireRole(context, "get_invoices");
      if (denied) {
        await audit(context, "get_invoices", false, { code: "access_denied" });
        return denied;
      }
      let query = admin.from("invoices").select("id, number, type, amount, subtotal, tax_amount, holdback_amount, holdback_released, status, due_date, description, created_at, paid_at, project_id, projects(name), clients(name)").eq("business_id", context.identity.businessId).order("created_at", { ascending: false }).limit(MAX_ROWS);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      await audit(context, "get_invoices", true, { count: data?.length ?? 0 });
      return jsonResult({ invoices: data ?? [] });
    },
  );

  server.registerTool(
    "get_receivables",
    {
      title: "Cuentas por cobrar",
      description: "Consulta el saldo pendiente y su antigüedad mediante el reporte financiero existente.",
      inputSchema: {},
    },
    async () => {
      const denied = requireRole(context, "get_receivables");
      if (denied) {
        await audit(context, "get_receivables", false, { code: "access_denied" });
        return denied;
      }
      const result = await receivables(admin, context.identity.businessId);
      await audit(context, "get_receivables", true, { total: result.total, invoices: result.invoices.length });
      return jsonResult(result);
    },
  );

  server.registerTool(
    "get_expenses",
    {
      title: "Gastos",
      description: "Consulta gastos registrados del negocio sin modificarlos.",
      inputSchema: { projectId: z.string().uuid().optional().describe("Filtrar por proyecto") },
    },
    async ({ projectId }) => {
      const denied = requireRole(context, "get_expenses");
      if (denied) {
        await audit(context, "get_expenses", false, { code: "access_denied" });
        return denied;
      }
      let query = admin.from("expenses").select("id, project_id, category, description, amount, date, projects(name)").eq("business_id", context.identity.businessId).order("date", { ascending: false }).limit(MAX_ROWS);
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw error;
      await audit(context, "get_expenses", true, { count: data?.length ?? 0 });
      return jsonResult({ expenses: data ?? [] });
    },
  );

  server.registerTool(
    "get_payments",
    {
      title: "Pagos recibidos",
      description: "Consulta pagos recibidos y su referencia sin enviar ni registrar nuevos pagos.",
      inputSchema: {},
    },
    async () => {
      const denied = requireRole(context, "get_payments");
      if (denied) {
        await audit(context, "get_payments", false, { code: "access_denied" });
        return denied;
      }
      const { data, error } = await admin.from("payments").select("id, invoice_id, amount, paid_at, method, reference, stripe_fee, stripe_fee_tax, stripe_net, invoices(number, project_id, clients(name))").eq("business_id", context.identity.businessId).order("paid_at", { ascending: false }).limit(MAX_ROWS);
      if (error) throw error;
      await audit(context, "get_payments", true, { count: data?.length ?? 0 });
      return jsonResult({ payments: data ?? [] });
    },
  );

  server.registerTool(
    "get_profitability",
    {
      title: "Rentabilidad por obra",
      description: "Consulta la rentabilidad calculada por los servicios financieros existentes; nunca modifica datos.",
      inputSchema: {},
    },
    async () => {
      const denied = requireRole(context, "get_profitability");
      if (denied) {
        await audit(context, "get_profitability", false, { code: "access_denied" });
        return denied;
      }
      const result = await profitabilityByProject(admin, admin, context.identity.businessId);
      await audit(context, "get_profitability", true, { count: result.length });
      return jsonResult({ projects: result });
    },
  );

  server.registerTool(
    "audit_quickbooks_sync",
    {
      title: "Auditoría de QuickBooks",
      description: "Consulta el estado y los errores registrados de la sincronización de QuickBooks, sin sincronizar nada.",
      inputSchema: {},
    },
    async () => {
      const denied = requireRole(context, "audit_quickbooks_sync");
      if (denied) {
        await audit(context, "audit_quickbooks_sync", false, { code: "access_denied" });
        return denied;
      }
      const { data, error } = await admin.from("quickbooks_links").select("local_id, kind, status, error, diverged, remote").eq("business_id", context.identity.businessId).order("status").limit(MAX_ROWS);
      if (error) throw error;
      const links = data ?? [];
      const result = { total: links.length, errors: links.filter((row: any) => row.error || row.status === "error").length, diverged: links.filter((row: any) => row.diverged === true).length, links };
      await audit(context, "audit_quickbooks_sync", true, { total: result.total, errors: result.errors, diverged: result.diverged });
      return jsonResult(result);
    },
  );

  return server;
}

export function mcpHandler(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  const metadataPath = req.originalUrl.startsWith("/api/")
    ? "/api/.well-known/oauth-protected-resource/mcp"
    : "/.well-known/oauth-protected-resource/mcp";
  if (!token) {
    const scheme = req.protocol;
    const metadata = `${scheme}://${req.get("host")}${metadataPath}`;
    res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${metadata}"`);
    res.status(401).json({ error: "Missing worker bearer token", code: "missing_token" });
    return;
  }

  resolveWorker(token)
    .then(async (identity) => {
      if (!identity) {
        const metadata = `${req.protocol}://${req.get("host")}${metadataPath}`;
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
