import type { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * How a job gets paid for, in stages.
 *
 * Nobody in construction charges once at the end. Money comes up front to buy
 * materials, again as the work advances, and the rest on completion — 50/25/25
 * is the shape most contractors here use. Before this the software knew three
 * unrelated invoice types and left the contractor to remember which stage they
 * were at and work each amount out by hand, which is how a stage gets billed
 * twice or not at all.
 *
 * A plan is a template on the business. Each project takes its own copy the
 * moment the estimate is accepted, because a schedule agreed in March must not
 * change because the contractor edited their default in June.
 *
 * The stages bill themselves off the project lifecycle: the same events that
 * move a project from planning to execution to confirmed are the ones a
 * contractor invoices against. `manual` is there for the stages that genuinely
 * are a judgement call.
 */

export type MilestoneTrigger = "manual" | "al_aceptar" | "al_iniciar" | "al_confirmar" | "al_terminar";

/**
 * The stages a business can pick from.
 *
 * `al_terminar` is deliberately not offered. A project only reaches
 * `completado` when its final invoice is paid, so a stage waiting on that
 * would bill after the money it was meant to collect had already arrived —
 * and a plan where every stage waited on it would deadlock: nothing bills, so
 * nothing is paid, so the job never closes. `al_confirmar` is the real "the
 * work is done, bill the rest" moment, and `manual` covers the rest. The
 * value stays valid in the database so any row already carrying it keeps
 * working.
 */
export const MILESTONE_TRIGGERS: MilestoneTrigger[] = [
  "manual",
  "al_aceptar",
  "al_iniciar",
  "al_confirmar",
];

export interface PlanMilestone {
  position: number;
  label: string;
  percent: number;
  trigger: MilestoneTrigger;
}

/**
 * What a business gets before it configures anything. Deliberately the
 * arrangement most of them already use on paper, so the common case needs no
 * setup at all — and `al_aceptar` / `al_iniciar` / `al_confirmar` means the
 * three invoices appear by themselves as the job moves.
 */
export const DEFAULT_PLAN: PlanMilestone[] = [
  { position: 1, label: "Depósito inicial", percent: 50, trigger: "al_aceptar" },
  { position: 2, label: "Avance de obra", percent: 25, trigger: "al_iniciar" },
  { position: 3, label: "Entrega final", percent: 25, trigger: "al_confirmar" },
];

/** Which invoice type a stage bills as. The last one settles the holdback. */
function invoiceTypeFor(milestone: PlanMilestone, isLast: boolean): "deposito" | "parcial" | "final" {
  if (isLast) return "final";
  return milestone.position === 1 ? "deposito" : "parcial";
}

type Admin = ReturnType<typeof getSupabaseAdmin>;

/** The percentages have to describe the whole job, or the last stage silently
 *  under- or over-bills. Tolerant of a cent of rounding, nothing more. */
export function planTotalsCorrectly(milestones: Pick<PlanMilestone, "percent">[]): boolean {
  const total = milestones.reduce((sum, m) => sum + Number(m.percent), 0);
  return Math.abs(total - 100) < 0.01;
}

export async function readPlan(admin: Admin, businessId: string): Promise<PlanMilestone[]> {
  const { data } = await admin
    .from("payment_plan_milestones")
    .select("position, label, percent, trigger")
    .eq("business_id", businessId)
    .order("position");
  if (!data || data.length === 0) return DEFAULT_PLAN;
  return data.map((m) => ({
    position: Number(m.position),
    label: m.label,
    percent: Number(m.percent),
    trigger: m.trigger as MilestoneTrigger,
  }));
}

/**
 * Copies the business's plan onto a project. Idempotent: a project that
 * already has a schedule keeps it, so re-accepting an estimate or replaying a
 * webhook cannot duplicate somebody's payment stages.
 */
export async function materializePlan(admin: Admin, businessId: string, projectId: string): Promise<void> {
  const { data: existing } = await admin
    .from("project_payment_milestones")
    .select("id")
    .eq("project_id", projectId)
    .limit(1);
  if (existing && existing.length > 0) return;

  const plan = await readPlan(admin, businessId);
  const { error } = await admin.from("project_payment_milestones").insert(
    plan.map((m) => ({
      business_id: businessId,
      project_id: projectId,
      position: m.position,
      label: m.label,
      percent: m.percent,
      trigger: m.trigger,
    }))
  );
  if (error) throw error;
}

/**
 * The value the percentages apply to: the accepted estimate's total.
 *
 * Approved change orders are added, because a customer who agreed to $4,000 of
 * extra work owes a share of it at each remaining stage — billing the stages
 * against the original figure would leave the extra money uninvoiced until
 * somebody noticed by hand.
 */
async function contractValue(admin: Admin, businessId: string, projectId: string): Promise<number> {
  const [project, changeOrders] = await Promise.all([
    admin.from("projects").select("estimate_id").eq("business_id", businessId).eq("id", projectId).maybeSingle(),
    admin
      .from("change_orders")
      .select("amount")
      .eq("business_id", businessId)
      .eq("project_id", projectId)
      .eq("status", "aprobado"),
  ]);

  let base = 0;
  if (project.data?.estimate_id) {
    const { data: estimate } = await admin
      .from("estimates")
      .select("total")
      .eq("id", project.data.estimate_id)
      .maybeSingle();
    base = Number(estimate?.total ?? 0);
  }
  const extras = (changeOrders.data ?? []).reduce((sum, c) => sum + Number(c.amount), 0);
  return Math.round((base + extras) * 100) / 100;
}

export interface BilledMilestone {
  milestoneId: string;
  invoiceId: string;
  subtotal: number;
}

/**
 * Bills one stage: works out its share of the contract, creates the invoice
 * through the same money rules every other invoice uses, and links the two.
 *
 * Returns null when there is nothing to bill — already invoiced, or a contract
 * value of zero because the estimate has no lines yet. Neither is an error;
 * both are reached by ordinary use.
 */
export async function billMilestone(
  admin: Admin,
  input: {
    businessId: string;
    projectId: string;
    milestoneId: string;
    createInvoice: (args: {
      businessId: string;
      clientId: string;
      projectId: string;
      estimateId: string | null;
      type: "deposito" | "parcial" | "final";
      subtotal: number;
      description: string;
    }) => Promise<string>;
  }
): Promise<BilledMilestone | null> {
  const { data: milestone } = await admin
    .from("project_payment_milestones")
    .select("id, position, label, percent, invoice_id")
    .eq("business_id", input.businessId)
    .eq("project_id", input.projectId)
    .eq("id", input.milestoneId)
    .maybeSingle();
  if (!milestone || milestone.invoice_id) return null;

  const { data: project } = await admin
    .from("projects")
    .select("client_id, estimate_id, name")
    .eq("business_id", input.businessId)
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return null;

  const total = await contractValue(admin, input.businessId, input.projectId);
  if (total <= 0) return null;

  const { data: all } = await admin
    .from("project_payment_milestones")
    .select("position")
    .eq("project_id", input.projectId)
    .order("position");
  const lastPosition = (all ?? []).at(-1)?.position ?? milestone.position;
  const isLast = Number(milestone.position) === Number(lastPosition);

  // Rounded once, here, because this is where it becomes the number on an
  // invoice a person reads.
  const subtotal = Math.round(total * (Number(milestone.percent) / 100) * 100) / 100;

  const invoiceId = await input.createInvoice({
    businessId: input.businessId,
    clientId: project.client_id,
    projectId: input.projectId,
    estimateId: project.estimate_id ?? null,
    type: invoiceTypeFor(
      { position: Number(milestone.position), label: milestone.label, percent: Number(milestone.percent), trigger: "manual" },
      isLast
    ),
    subtotal,
    description: `${milestone.label} — ${Number(milestone.percent)}%`,
  });

  const { error } = await admin
    .from("project_payment_milestones")
    .update({ invoice_id: invoiceId, billed_at: new Date().toISOString() })
    .eq("id", milestone.id);
  if (error) throw error;

  return { milestoneId: milestone.id, invoiceId, subtotal };
}

/**
 * Bills every unbilled stage waiting on a lifecycle event. Called from the
 * transition itself, so the invoice appears the moment the thing it bills for
 * actually happened — not when somebody next opens the Invoicing screen.
 *
 * Never throws into the caller: a stage that failed to bill is worth a log
 * line and a button, not a failed check-in.
 */
export async function billMilestonesForTrigger(
  admin: Admin,
  input: {
    businessId: string;
    projectId: string;
    trigger: Exclude<MilestoneTrigger, "manual">;
    createInvoice: Parameters<typeof billMilestone>[1]["createInvoice"];
  }
): Promise<BilledMilestone[]> {
  try {
    const { data: due } = await admin
      .from("project_payment_milestones")
      .select("id")
      .eq("business_id", input.businessId)
      .eq("project_id", input.projectId)
      .eq("trigger", input.trigger)
      .is("invoice_id", null)
      .order("position");

    const billed: BilledMilestone[] = [];
    for (const milestone of due ?? []) {
      const result = await billMilestone(admin, {
        businessId: input.businessId,
        projectId: input.projectId,
        milestoneId: milestone.id,
        createInvoice: input.createInvoice,
      });
      if (result) billed.push(result);
    }
    return billed;
  } catch (err) {
    console.error("[paymentPlans] could not bill", input.projectId, input.trigger, err);
    return [];
  }
}

/**
 * The lifecycle states that bill a stage, keyed by the trigger that names them.
 *
 * `completado` is absent on purpose: it is reached by the final invoice being
 * paid, so billing anything there would be billing after the fact. See
 * MILESTONE_TRIGGERS.
 */
export const TRIGGER_FOR_STATUS: Record<string, Exclude<MilestoneTrigger, "manual">> = {
  planificacion: "al_aceptar",
  en_progreso: "al_iniciar",
  confirmado: "al_confirmar",
};
