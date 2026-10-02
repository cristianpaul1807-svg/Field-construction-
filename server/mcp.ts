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
import { calcularFactura } from "./calculoDeFactura";
import { resumenDeHoras } from "./resumenDeHoras";
import { fatturaPADeFactura, fatturaPADeNota } from "./fatturaPAServidor";
import { ritenutaBancaria } from "../shared/bonusEdilizi";
import { papelesQueVencen } from "./papelesQueVencen";
import { congruitaDeLaObra } from "./congruitaServidor";
import { estadoSalDellaObra } from "./salServidor";
import { grupoDePais, paisDe } from "../shared/paises";
import { OPCIONES_IVA } from "../shared/iva";
import { esCodiceFiscaleValido, esPartitaIvaValida } from "../shared/fiscaleItalia";

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
  /**
   * El país del negocio. Decide la moneda de cada importe que se devuelve,
   * qué impuesto se calcula y qué herramientas existen —QuickBooks sólo donde
   * funciona—, igual que decide el menú del panel.
   */
  country: string | null;
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
  const columnas = "id, name, subscription_plan, subscription_status, trial_ends_at, country";

  const construir = (
    negocio: { id: string; name?: string | null; subscription_plan?: string | null; subscription_status?: string | null; trial_ends_at?: string | null; country?: string | null },
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
      country: negocio.country ?? null,
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

  // Cuándo se usó por última vez.
  //
  // La columna existía y **no la escribía nadie**, así que el panel enseñaba
  // «conectado» sin poder decir desde cuándo ni si seguía viva. Importa porque
  // cuando alguien borra el conector en Claude no nos avisa nadie: no hay
  // devolución de llamada en OAuth para «me han desinstalado». Lo único que se
  // nota es que dejan de venir peticiones, y para notarlo hay que apuntarlas.
  //
  // Sin esperar la respuesta: esto va delante de cada consulta del usuario y
  // un sello no puede hacerla más lenta ni tumbarla si falla.
  void admin
    .from("mcp_connections")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", oauth.connection_id)
    .then(({ error }) => {
      if (error) console.error("[MCP] no se pudo anotar el uso", error.message);
    });
  if (connection.owner_auth_user_id) {
    // La **misma** función que usó el formulario de consentimiento para dejarle
    // entrar. Ver `resolveOwnerIdentity`: que aquí se comprobara otra cosa es
    // lo que tenía a Claude dando vueltas.
    return resolveOwnerIdentity(connection.owner_auth_user_id, connection.business_id);
  }
  const table = connection.employee_id ? "employees" : "subcontractors";
  const select = connection.employee_id
    ? "id, business_id, name, role, roles(name, permissions), businesses(subscription_plan, subscription_status, trial_ends_at, country)"
    : "id, business_id, name, trade, roles(name, permissions), businesses(subscription_plan, subscription_status, trial_ends_at, country)";
  const { data: row, error } = await admin.from(table).select(select).eq("id", id).eq("business_id", connection.business_id).maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const business = (row as any).businesses as { subscription_plan?: string | null; subscription_status?: string | null; trial_ends_at?: string | null; country?: string | null } | null;
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
    country: business?.country ?? null,
  };
}

export async function resolveWorker(token: string): Promise<WorkerIdentity | null> {
  const admin = getSupabaseAdmin();
  const hash = hashToken(token);
  const [employee, subcontractor] = await Promise.all([
    admin
      .from("employees")
      .select("id, business_id, name, role, role_id, status, roles(name, permissions), businesses(subscription_plan, subscription_status, trial_ends_at, country)")
      .eq("access_token_hash", hash)
      .maybeSingle(),
    admin
      .from("subcontractors")
      .select("id, business_id, name, trade, role_id, roles(name, permissions), businesses(subscription_plan, subscription_status, trial_ends_at, country)")
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
    country?: string | null;
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
    country: business?.country ?? null,
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
  // La moneda viaja con cada importe. Sin ella Claude tiene que adivinar si
  // 12.500 son dólares o euros, y adivina lo que más ha leído: dólares.
  const pais = paisDe(context.identity.country);
  const currency = pais.moneda;

  server.registerTool(
    "get_my_schedule",
    {
      title: "My schedule",
      description: "The worker's own events and work orders for one day.",
      inputSchema: {
        date: z.string().optional().describe("Local date, YYYY-MM-DD"),
        timezoneOffsetMinutes: z.number().optional().describe("Local offset from UTC, in minutes"),
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
      title: "My work orders",
      description: "Work orders assigned to this worker.",
      inputSchema: { status: z.string().optional().describe("Filter by status") },
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
      title: "My projects",
      description: "Projects this worker is linked to through an assignment, the schedule or a work order.",
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
      title: "My tasks",
      description: "Open tasks assigned to this worker.",
      inputSchema: { includeCompleted: z.boolean().optional().describe("Include completed ones") },
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
      title: "My hours",
      description: "Hours this worker has clocked. Read-only: it never changes a clock-in.",
      inputSchema: { from: z.string().optional().describe("Start date, ISO"), to: z.string().optional().describe("End date, ISO") },
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
      title: "My documents",
      description: "Documents the office has made visible to this worker.",
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
      title: "Projects",
      description: "Projects within this person's scope: all of them for the owner, the assigned ones for a site manager.",
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
      title: "Project detail",
      description: "One project within this person's scope.",
      inputSchema: { projectId: z.string().uuid().describe("Project id") },
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
      title: "Project schedule",
      description: "Planned events and work orders of one project within scope.",
      inputSchema: { projectId: z.string().uuid().describe("Project id") },
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
      title: "Work orders",
      description: "Work orders of the projects within scope. Read-only.",
      inputSchema: { status: z.string().optional().describe("Filter by status") },
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
      title: "Team",
      description: "Employees and subcontractors linked to the projects within scope, without pay or sensitive data.",
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
      title: "Business summary",
      description: "Aggregate figures for the business, plus its country, currency and tax system. Call this first to know how to read every other amount.",
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
        // Lo que hace falta para leer todo lo demás: en qué moneda están los
        // importes, qué impuesto se aplica y qué cosas existen en este país.
        business: {
          country: context.identity.country ?? "CA",
          currency,
          taxSystem: pais.impuestos,
          cardPayments: pais.cobrosConTarjeta,
          quickbooks: pais.quickbooks,
          payroll: pais.nomina,
        },
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
      title: "Invoices",
      description: "Invoices of the business with their tax breakdown. Amounts are in `currency`. Read-only: never creates, changes or sends an invoice.",
      inputSchema: { status: z.string().optional().describe("Filter by invoice status") },
    },
    async ({ status }) => {
      const denied = requireRole(context, "get_invoices");
      if (denied) {
        await audit(context, "get_invoices", false, { code: "access_denied" });
        return denied;
      }
      let query = admin.from("invoices").select("id, number, type, amount, subtotal, tax_amount, tax_breakdown, holdback_amount, holdback_released, status, due_date, description, created_at, paid_at, project_id, projects(name, bonus_fiscale), clients(name)").eq("business_id", context.identity.businessId).order("created_at", { ascending: false }).limit(MAX_ROWS);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      await audit(context, "get_invoices", true, { count: data?.length ?? 0 });
      return jsonResult({ currency, invoices: data ?? [] });
    },
  );

  server.registerTool(
    "get_receivables",
    {
      title: "Receivables",
      description: "What clients still owe and how old it is. Amounts are in `currency`.",
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
      return jsonResult({ currency, ...result });
    },
  );

  server.registerTool(
    "get_expenses",
    {
      title: "Expenses",
      description: "Recorded expenses of the business. Amounts are in `currency`. Read-only.",
      inputSchema: { projectId: z.string().uuid().optional().describe("Filter by project") },
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
      return jsonResult({ currency, expenses: data ?? [] });
    },
  );

  server.registerTool(
    "get_payments",
    {
      title: "Payments received",
      description: "Payments received and their reference. Amounts are in `currency`. Read-only.",
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
      return jsonResult({ currency, payments: data ?? [] });
    },
  );

  server.registerTool(
    "get_profitability",
    {
      title: "Profitability by project",
      description: "Profitability per project from the existing financial reports. Amounts are in `currency`. Read-only.",
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
      return jsonResult({ currency, projects: result });
    },
  );

  server.registerTool(
    "audit_quickbooks_sync",
    {
      title: "QuickBooks sync audit",
      description: "Status and errors of the QuickBooks sync. Never syncs anything.",
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

  server.registerTool(
    "get_estimates",
    {
      title: "Estimates",
      description: "Estimates of the business. `total` is before tax, which is what is stored and invoiced; the tax depends on the country (see get_business_summary). Amounts are in `currency`. Read-only.",
      inputSchema: { status: z.string().optional().describe("Filter by status: borrador, enviado, aceptado, rechazado") },
    },
    async ({ status }) => {
      const denied = requireRole(context, "get_estimates");
      if (denied) {
        await audit(context, "get_estimates", false, { code: "access_denied" });
        return denied;
      }
      let query = admin.from("estimates").select("id, number, status, total, description, created_at, client_id, clients(name), project_id, projects(name)").eq("business_id", context.identity.businessId).order("created_at", { ascending: false }).limit(MAX_ROWS);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      await audit(context, "get_estimates", true, { count: data?.length ?? 0 });
      return jsonResult({ currency, estimates: data ?? [] });
    },
  );

  server.registerTool(
    "get_clients",
    {
      title: "Clients",
      description: "Clients and leads of the business with their contact details and, in Italy, their tax ids. Read-only.",
      inputSchema: { search: z.string().optional().describe("Part of the client's name") },
    },
    async ({ search }) => {
      const denied = requireRole(context, "get_clients");
      if (denied) {
        await audit(context, "get_clients", false, { code: "access_denied" });
        return denied;
      }
      // Sin `access_token` ni su hash: es la llave del portal del cliente, y
      // no tiene nada que hacer en una conversación.
      let query = admin.from("clients").select("id, name, email, phone, address, lead_status, created_at, partita_iva, codice_fiscale, pec, codice_destinatario").eq("business_id", context.identity.businessId).order("created_at", { ascending: false }).limit(MAX_ROWS);
      // Los comodines fuera: buscar «%» no debería traer a todo el mundo.
      const nombre = search?.trim().replace(/[%_,()]/g, "");
      if (nombre) query = query.ilike("name", `%${nombre}%`);
      const { data, error } = await query;
      if (error) throw error;
      await audit(context, "get_clients", true, { count: data?.length ?? 0 });
      return jsonResult({ clients: data ?? [] });
    },
  );

  server.registerTool(
    "calculate_invoice",
    {
      title: "Calculate an invoice",
      description:
        "What an invoice would come to, without creating it: the tax of this business's country, the holdback withheld or released, and the amount the client pays. Uses exactly the same calculation as a real invoice. Nothing is saved.",
      inputSchema: {
        subtotal: z.number().positive().describe("Amount before tax"),
        type: z.enum(["deposito", "parcial", "final"]).describe("deposito (deposit), parcial (progress payment) or final"),
        projectId: z.string().uuid().optional().describe("For a final invoice: the project, so the holdback withheld so far is released"),
        iva: z.enum(OPCIONES_IVA).optional().describe("Italy only: 22, 10, 4, or rc (inversione contabile). Defaults to the business's usual VAT"),
      },
    },
    async ({ subtotal, type, projectId, iva }) => {
      const denied = requireRole(context, "calculate_invoice");
      if (denied) {
        await audit(context, "calculate_invoice", false, { code: "access_denied" });
        return denied;
      }
      const cuenta = await calcularFactura(admin, {
        businessId: context.identity.businessId,
        subtotal,
        type,
        projectId: projectId ?? null,
        iva: grupoDePais(context.identity.country) === "IT" ? iva : undefined,
      });
      // Por si el país perdió su impuesto entre el listado y la llamada: la
      // respuesta no puede ser una cifra sin impuesto con aspecto de buena.
      if ((cuenta.breakdown as { sinConfigurar?: boolean }).sinConfigurar) {
        await audit(context, "calculate_invoice", false, { code: "pais_sin_configurar" });
        return errorResult("This country's taxes are not configured yet, so invoices cannot be calculated or issued.", "pais_sin_configurar");
      }
      const result = {
        saved: false,
        currency,
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount: cuenta.taxAmount,
        taxBreakdown: cuenta.breakdown,
        holdbackPercent: cuenta.holdbackPercent,
        holdbackWithheld: cuenta.holdbackAmount,
        holdbackReleased: cuenta.holdbackReleased,
        amountDue: cuenta.amount,
      };
      await audit(context, "calculate_invoice", true, { type, subtotal: result.subtotal, amountDue: result.amountDue });
      return jsonResult(result);
    },
  );

  server.registerTool(
    "check_italian_tax_id",
    {
      title: "Check an Italian tax id",
      description: "Checks a Partita IVA (11 digits) or a codice fiscale (16 characters) with its control character. Reads nothing from the business.",
      inputSchema: { value: z.string().min(1).max(32).describe("The Partita IVA or codice fiscale to check") },
    },
    async ({ value }) => {
      const denied = requireRole(context, "check_italian_tax_id");
      if (denied) {
        await audit(context, "check_italian_tax_id", false, { code: "access_denied" });
        return denied;
      }
      const limpio = value.replace(/\s+/g, "").toUpperCase().replace(/^IT/, "");
      const kind = /^\d{11}$/.test(limpio) ? "partita_iva" : limpio.length === 16 ? "codice_fiscale" : "unknown";
      const valid = kind === "partita_iva" ? esPartitaIvaValida(limpio) : kind === "codice_fiscale" ? esCodiceFiscaleValido(limpio) : false;
      // Sin el número en la auditoría: es un dato personal y no hace falta
      // para saber que se usó la herramienta.
      await audit(context, "check_italian_tax_id", true, { kind, valid });
      return jsonResult({ value: limpio, kind, valid });
    },
  );

  server.registerTool(
    "get_monthly_hours",
    {
      title: "Monthly hours for payroll",
      description:
        "Per employee, for one month: regular hours, overtime hours and the working days of each absence (holiday, sickness, leave, public holiday, bad weather, work injury), with the day-by-day detail. This is what the payroll consultant needs (in Italy, the consulente del lavoro). Only approved clock-ins count; `sinAprobar` says how many were left out.",
      inputSchema: { month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).describe("Month, YYYY-MM") },
    },
    async ({ month }) => {
      const denied = requireRole(context, "get_monthly_hours");
      if (denied) {
        await audit(context, "get_monthly_hours", false, { code: "access_denied" });
        return denied;
      }
      const result = await resumenDeHoras(admin, context.identity.businessId, month);
      await audit(context, "get_monthly_hours", true, { month, people: result.personas.length, unapproved: result.sinAprobar });
      return jsonResult(result);
    },
  );

  server.registerTool(
    "get_e_invoice",
    {
      title: "Italian e-invoice (FatturaPA XML)",
      description:
        "The FatturaPA XML of an issued invoice or credit note, ready to upload to the SDI, checked against the official schema. If the business or the client is missing data (Partita IVA, codice fiscale, address), it returns exactly what is missing and from whom instead of an XML the SDI would reject. Read-only: it does not send anything to the SDI.",
      inputSchema: {
        id: z.string().uuid().describe("Invoice id (from get_invoices) or credit note id"),
        kind: z.enum(["invoice", "credit_note"]).optional().describe("Defaults to invoice"),
      },
    },
    async ({ id, kind }) => {
      const denied = requireRole(context, "get_e_invoice");
      if (denied) {
        await audit(context, "get_e_invoice", false, { code: "access_denied" });
        return denied;
      }
      const r = kind === "credit_note"
        ? await fatturaPADeNota(admin, context.identity.businessId, id)
        : await fatturaPADeFactura(admin, context.identity.businessId, id);
      await audit(context, "get_e_invoice", r.ok, r.ok ? { file: r.nombre } : { code: r.code });
      // Lo que falta, entero y con su forma: Claude se lo cuenta a la persona
      // y le dice dónde rellenarlo, en vez de un «no se pudo».
      if (!r.ok) return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: "The e-invoice cannot be generated.", ...r }) }] };
      return jsonResult({ fileName: r.nombre, xml: r.xml });
    },
  );

  server.registerTool(
    "get_bank_withholdings",
    {
      title: "Bank withholdings on tax-bonus payments",
      description:
        "Italy: when a client pays an invoice of a job with a tax bonus (bonus edilizi) by bonifico parlante, the bank withholds 11% of the amount net of VAT (VAT always removed at 22%) on account of the business's taxes. This returns, for a year, each paid invoice of a bonus job with the expected withholding and the total: a tax credit for the business, not an unpaid amount.",
      inputSchema: { year: z.number().int().min(2000).max(2100).describe("Year, e.g. 2026") },
    },
    async ({ year }) => {
      const denied = requireRole(context, "get_bank_withholdings");
      if (denied) {
        await audit(context, "get_bank_withholdings", false, { code: "access_denied" });
        return denied;
      }
      const { data, error } = await admin
        .from("invoices")
        .select("number, amount, paid_at, projects!inner(name, bonus_fiscale), clients(name)")
        .eq("business_id", context.identity.businessId)
        .eq("status", "pagado")
        .not("projects.bonus_fiscale", "is", null)
        .gte("paid_at", `${year}-01-01`)
        .lt("paid_at", `${year + 1}-01-01`)
        .order("paid_at")
        .limit(MAX_ROWS);
      if (error) throw error;
      const invoices = (data ?? []).map((i: any) => ({
        number: i.number,
        client: i.clients?.name ?? null,
        project: i.projects?.name ?? null,
        bonus: i.projects?.bonus_fiscale ?? null,
        paidAt: i.paid_at,
        amount: Number(i.amount),
        withholding: ritenutaBancaria(Number(i.amount)),
      }));
      const total = Math.round(invoices.reduce((s, i) => s + i.withholding, 0) * 100) / 100;
      await audit(context, "get_bank_withholdings", true, { year, count: invoices.length });
      return jsonResult({ currency, year, rate: 0.11, total, invoices });
    },
  );

  server.registerTool(
    "get_expiring_documents",
    {
      title: "Documents that expire",
      description:
        "Workers' and subcontractors' documents that have expired or expire within `days` (default 30): in Italy the DURC, safety training, medical checks, the patente a crediti, the site ID card. `daysLeft` is negative when already expired. Someone with an expired document can't work on site.",
      inputSchema: { days: z.number().int().min(0).max(365).optional().describe("Look this many days ahead (default 30)") },
    },
    async ({ days }) => {
      const denied = requireRole(context, "get_expiring_documents");
      if (denied) {
        await audit(context, "get_expiring_documents", false, { code: "access_denied" });
        return denied;
      }
      const result = await papelesQueVencen(admin, context.identity.businessId, days ?? 30);
      await audit(context, "get_expiring_documents", true, { count: result.length });
      return jsonResult({ documents: result });
    },
  );

  server.registerTool(
    "get_progress_claims",
    {
      title: "Progress claims (SAL) of a job",
      description:
        "The progress claims of a job (in Italy, SAL — stato avanzamento lavori): each one certifies, item by item of the accepted estimate plus approved change orders, the cumulative % completed, valued at contract prices. Returns the contract value, what is certified to date, the deposit invoiced and how much of it the claims already recovered, each claim with its amount and invoice, and every item with its % at the last claim. Amounts are before tax. Use get_projects to find the project id.",
      inputSchema: { projectId: z.string().uuid().describe("Project id") },
    },
    async ({ projectId }) => {
      const denied = requireRole(context, "get_progress_claims");
      if (denied) {
        await audit(context, "get_progress_claims", false, { code: "access_denied" });
        return denied;
      }
      const estado = await estadoSalDellaObra(admin, context.identity.businessId, projectId);
      await audit(context, "get_progress_claims", Boolean(estado), { projectId });
      if (!estado) return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: "Project not found.", code: "not_found" }) }] };
      return jsonResult({
        currency,
        contractValue: estado.contratto,
        certifiedToDate: estado.cumulatoPrecedente,
        depositInvoiced: estado.acconti,
        depositRecovered: estado.accontoGiaRecuperato,
        claims: estado.sal.map((s) => ({
          number: s.numero,
          date: s.data,
          amount: s.importo,
          cumulative: s.importoCumulato,
          depositRecovered: s.recuperoAcconto,
          invoiceNumber: s.invoiceStatus === "cancelado" ? null : s.invoiceNumber,
        })),
        items: estado.righe.map((r) => ({ description: r.descrizione, area: r.zona, contractAmount: r.importo, percentComplete: r.percentualePrecedente })),
      });
    },
  );

  server.registerTool(
    "check_congruita",
    {
      title: "Labour congruity of a job",
      description:
        "Italy (DM 143/2021): before the final payment of a public job, or a private one worth €70,000 or more, the Cassa Edile checks that the labour declared on the job reaches a minimum percentage of its value, set by work category (e.g. 22% for renovating residential buildings). Without it the client cannot pay the final balance. This estimates it from approved hours × each person's hourly cost. `estado`: congrua (reached), tolleranza (short by 5% or less: certified with the works director's statement), non_congrua (short; `falta` is the missing labour amount), no_aplica, sin_categoria, sin_valor. `oreSenzaCosto` are approved hours of people with no hourly cost, which don't count. Use get_projects to find the project id.",
      inputSchema: { projectId: z.string().uuid().describe("Project id") },
    },
    async ({ projectId }) => {
      const denied = requireRole(context, "check_congruita");
      if (denied) {
        await audit(context, "check_congruita", false, { code: "access_denied" });
        return denied;
      }
      const r = await congruitaDeLaObra(admin, context.identity.businessId, projectId);
      await audit(context, "check_congruita", r.ok, r.ok ? { projectId, estado: r.congruita.estado } : { projectId, code: r.code });
      if (!r.ok) return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: "Congruity cannot be checked.", code: r.code }) }] };
      return jsonResult({ currency, ...r.congruita });
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
