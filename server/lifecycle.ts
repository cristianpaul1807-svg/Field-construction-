import type { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * The project lifecycle.
 *
 * A construction job is not a row somebody edits — it is a sequence of things
 * that happen: the customer accepts the price, the crew gets scheduled,
 * somebody clocks in on site, the work orders close, the final invoice gets
 * paid. Before this module each of those wrote its own table and nobody moved
 * the project forward, so a job that had been finished for a month still read
 * "planificación" in the panel and the contractor had no way to know which of
 * their jobs were actually running.
 *
 * So the status is derived from those events rather than typed by hand. Every
 * transition is recorded in `project_status_events` with what caused it, which
 * is what makes "when did this job actually start" answerable later.
 *
 * The four states are the ones the business uses out loud:
 *
 *   planificacion → programación: accepted, being scheduled, nobody on site yet
 *   en_progreso   → ejecución:    someone has clocked in or an order is running
 *   confirmado    → work finished and signed off; money may still be owed
 *   completado    → terminado: final invoice paid, nothing left open
 *
 * `pausado` sits outside the sequence. It is a deliberate human decision — a
 * permit hold, a customer who stopped answering — so no automatic event lifts
 * it. Someone has to say the job resumed.
 */

export type ProjectStatus = "planificacion" | "en_progreso" | "confirmado" | "completado" | "pausado";

/** The door the job came in through. Each one leaves a different first gap. */
export type ProjectOrigin = "panel" | "chat_publico" | "portal_cliente";

export type LifecycleActor = "admin" | "cliente" | "trabajador" | "sistema";

/**
 * The door is recorded on the client when they first appear, so the project
 * inherits it rather than asking again: `link_publico` is a stranger who used
 * the public chat, `chat_cliente` is somebody who already had portal access
 * and wrote from inside it, and anything else was typed in by the contractor.
 */
export function originFromClientSource(source: string | null | undefined): ProjectOrigin {
  if (source === "link_publico") return "chat_publico";
  if (source === "chat_cliente") return "portal_cliente";
  return "panel";
}

/**
 * What happened in the software. These are named after the event, not after
 * the state, because the same state can be reached several ways and the
 * history is only useful if it says which one.
 */
export type LifecycleTrigger =
  | "presupuesto_aceptado"
  | "trabajo_programado"
  | "primer_fichaje"
  | "orden_iniciada"
  | "ordenes_completadas"
  | "cliente_confirmo"
  | "factura_final_pagada"
  | "cambio_manual"
  | "proyecto_creado";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "planificacion",
  "en_progreso",
  "confirmado",
  "completado",
  "pausado",
];

/** The happy path, in order. `pausado` is deliberately not in it. */
const SEQUENCE: ProjectStatus[] = ["planificacion", "en_progreso", "confirmado", "completado"];

function rank(status: string): number {
  const index = SEQUENCE.indexOf(status as ProjectStatus);
  return index === -1 ? -1 : index;
}

/** The state each automatic trigger is evidence of. */
const TRIGGER_TARGET: Record<Exclude<LifecycleTrigger, "cambio_manual">, ProjectStatus> = {
  proyecto_creado: "planificacion",
  presupuesto_aceptado: "planificacion",
  trabajo_programado: "planificacion",
  primer_fichaje: "en_progreso",
  orden_iniciada: "en_progreso",
  ordenes_completadas: "confirmado",
  cliente_confirmo: "confirmado",
  factura_final_pagada: "completado",
};

type Admin = ReturnType<typeof getSupabaseAdmin>;

interface AdvanceInput {
  businessId: string;
  projectId: string;
  trigger: Exclude<LifecycleTrigger, "cambio_manual">;
  actor: LifecycleActor;
  note?: string;
}

/**
 * Moves a project forward because something real happened.
 *
 * Forward only, and never out of `pausado`. A worker clocking in on a job the
 * office paused should not silently un-pause it — the check-in is still
 * recorded, the office still decides. Reaching a state the project is already
 * past is a no-op rather than an error, because these fire from ordinary
 * writes (every check-in, every closed work order) and must be cheap to call
 * unconditionally.
 *
 * Never throws into the caller's request: a status that failed to advance is
 * worth a log line, not a failed check-in.
 */
export async function advanceProject(admin: Admin, input: AdvanceInput): Promise<ProjectStatus | null> {
  try {
    const { data: project } = await admin
      .from("projects")
      .select("id, status")
      .eq("business_id", input.businessId)
      .eq("id", input.projectId)
      .maybeSingle();
    if (!project) return null;

    const current = project.status as ProjectStatus;
    if (current === "pausado") return null;

    const target = TRIGGER_TARGET[input.trigger];
    if (rank(target) <= rank(current)) return null;

    const { error } = await admin
      .from("projects")
      .update({ status: target, status_changed_at: new Date().toISOString() })
      .eq("business_id", input.businessId)
      .eq("id", input.projectId);
    if (error) throw error;

    await recordTransition(admin, {
      businessId: input.businessId,
      projectId: input.projectId,
      from: current,
      to: target,
      trigger: input.trigger,
      actor: input.actor,
      note: input.note,
    });

    return target;
  } catch (err) {
    console.error("[lifecycle] advance failed", input.projectId, input.trigger, err);
    return null;
  }
}

/**
 * The admin setting the status by hand.
 *
 * Any transition is allowed — pausing for a permit, reopening a closed job for
 * a warranty callback, marking a cash job complete without an invoice in the
 * system. The business owner knows things the software does not, and refusing
 * their edit would just make them lie to the software elsewhere. What matters
 * is that the history says a human did it.
 */
export async function setProjectStatus(
  admin: Admin,
  input: { businessId: string; projectId: string; status: ProjectStatus; actor: LifecycleActor; note?: string }
): Promise<void> {
  const { data: project } = await admin
    .from("projects")
    .select("id, status")
    .eq("business_id", input.businessId)
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return;
  if (project.status === input.status) return;

  const { error } = await admin
    .from("projects")
    .update({ status: input.status, status_changed_at: new Date().toISOString() })
    .eq("business_id", input.businessId)
    .eq("id", input.projectId);
  if (error) throw error;

  await recordTransition(admin, {
    businessId: input.businessId,
    projectId: input.projectId,
    from: project.status,
    to: input.status,
    trigger: "cambio_manual",
    actor: input.actor,
    note: input.note,
  });
}

async function recordTransition(
  admin: Admin,
  entry: {
    businessId: string;
    projectId: string;
    from: string | null;
    to: string;
    trigger: LifecycleTrigger;
    actor: LifecycleActor;
    note?: string;
  }
): Promise<void> {
  const { error } = await admin.from("project_status_events").insert({
    business_id: entry.businessId,
    project_id: entry.projectId,
    from_status: entry.from,
    to_status: entry.to,
    trigger: entry.trigger,
    actor: entry.actor,
    note: entry.note ?? null,
  });
  // The log is evidence, not a gate: losing a row must not undo the move.
  if (error) console.error("[lifecycle] could not record transition", entry.projectId, error);
}

/**
 * Closing the last open work order is what says the work is done, so it has to
 * be checked after every order that closes rather than counted once. Returns
 * true only when there was at least one order and none of them is still open —
 * a project with no work orders at all has not finished, it has not started.
 */
export async function checkWorkOrdersComplete(
  admin: Admin,
  businessId: string,
  projectId: string
): Promise<boolean> {
  const { data } = await admin
    .from("work_orders")
    .select("status")
    .eq("business_id", businessId)
    .eq("project_id", projectId);
  if (!data || data.length === 0) return false;
  return data.every((order) => order.status === "completada");
}

// ---------- The execution order, per entry flow ----------

/**
 * One step of the checklist the panel shows for a project.
 *
 * `key` is a slug the client translates; nothing here is user-visible text,
 * because these travel to four languages.
 */
export interface LifecycleStep {
  key: string;
  status: ProjectStatus;
  done: boolean;
}

export interface LifecycleSnapshot {
  status: ProjectStatus;
  origin: ProjectOrigin;
  statusChangedAt: string | null;
  steps: LifecycleStep[];
  /** The first step still open. Null once everything is done. */
  nextStep: string | null;
  history: Array<{
    from: string | null;
    to: string;
    trigger: string;
    actor: string;
    note: string | null;
    at: string;
  }>;
}

/**
 * The first step differs by door, and that is the whole point of tracking the
 * origin: a lead from the public chat has no account and no history, a portal
 * client already has both, and a job the contractor typed in never was a lead.
 * Showing the same checklist for all three would make two of them permanently
 * incomplete.
 */
const FIRST_STEP: Record<ProjectOrigin, string> = {
  chat_publico: "solicitud_chat",
  portal_cliente: "solicitud_portal",
  panel: "alta_manual",
};

/**
 * Builds the checklist for one project from what actually exists in the
 * database, rather than from the status column — so a project whose status was
 * moved by hand still shows honestly which pieces are missing.
 */
export async function lifecycleSnapshot(
  admin: Admin,
  businessId: string,
  projectId: string
): Promise<LifecycleSnapshot | null> {
  const { data: project } = await admin
    .from("projects")
    .select("id, status, origin, status_changed_at, estimate_id")
    .eq("business_id", businessId)
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const [estimate, events, orders, entries, invoices, history] = await Promise.all([
    project.estimate_id
      ? admin.from("estimates").select("status").eq("id", project.estimate_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("schedule_events").select("id").eq("business_id", businessId).eq("project_id", projectId).limit(1),
    admin.from("work_orders").select("status").eq("business_id", businessId).eq("project_id", projectId),
    admin.from("time_entries").select("id").eq("business_id", businessId).eq("project_id", projectId).limit(1),
    admin.from("invoices").select("type, status").eq("business_id", businessId).eq("project_id", projectId),
    admin
      .from("project_status_events")
      .select("from_status, to_status, trigger, actor, note, created_at")
      .eq("business_id", businessId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const orderRows = orders.data ?? [];
  const invoiceRows = invoices.data ?? [];
  const finalInvoice = invoiceRows.find((i) => i.type === "final");

  const steps: LifecycleStep[] = [
    { key: FIRST_STEP[(project.origin as ProjectOrigin) ?? "panel"], status: "planificacion", done: true },
    {
      key: "presupuesto_aceptado",
      status: "planificacion",
      done: (estimate.data as { status?: string } | null)?.status === "aceptado",
    },
    { key: "trabajo_programado", status: "planificacion", done: (events.data ?? []).length > 0 },
    { key: "equipo_en_obra", status: "en_progreso", done: (entries.data ?? []).length > 0 },
    {
      key: "ordenes_completadas",
      status: "confirmado",
      done: orderRows.length > 0 && orderRows.every((o) => o.status === "completada"),
    },
    { key: "factura_final_emitida", status: "confirmado", done: Boolean(finalInvoice) },
    { key: "factura_final_pagada", status: "completado", done: finalInvoice?.status === "pagado" },
  ];

  return {
    status: project.status as ProjectStatus,
    origin: ((project.origin as ProjectOrigin) ?? "panel"),
    statusChangedAt: project.status_changed_at ?? null,
    steps,
    nextStep: steps.find((s) => !s.done)?.key ?? null,
    history: (history.data ?? []).map((h) => ({
      from: h.from_status,
      to: h.to_status,
      trigger: h.trigger,
      actor: h.actor,
      note: h.note,
      at: h.created_at,
    })),
  };
}
