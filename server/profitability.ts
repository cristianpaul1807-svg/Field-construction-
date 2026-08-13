import type { getSupabaseAdmin } from "./supabaseAdmin";
import { labourCostByProject } from "./payroll";

/**
 * What each job was worth, what it cost, and what has actually been collected.
 *
 * The four numbers exist separately all over this product — the estimate, the
 * expenses, the invoices, the payments — and never in one row. Which means the
 * question a contractor asks every week, "is this job making money", could
 * only be answered by opening four screens and doing arithmetic. Most people
 * do not, and find out at the end.
 *
 * Kept as four columns rather than one score on purpose. A job can be
 * profitable and unpaid, or paid and losing money, and those are different
 * emergencies.
 */

type Db = ReturnType<typeof getSupabaseAdmin>;

export interface ProjectProfit {
  projectId: string;
  name: string;
  clientName: string | null;
  status: string;
  /** Estimate total plus approved change orders. What the job is worth. */
  contractValue: number;
  /** Materials, subcontractors and everything else booked against the job. */
  expenses: number;
  /** Approved hours costed at each worker's rate. Zero when no rates are set. */
  labour: number;
  cost: number;
  /** Invoiced so far, whether or not it has been paid. */
  invoiced: number;
  /** Actually collected. */
  collected: number;
  /** contractValue − cost. The number the job is really about. */
  margin: number;
  /** margin as a percentage of contractValue, null when there is no contract. */
  marginPercent: number | null;
  /** Contract not yet invoiced. What is still to bill. */
  toInvoice: number;
  /** Invoiced and not yet collected. */
  outstanding: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

export async function profitabilityByProject(
  db: Db,
  admin: Db,
  businessId: string,
  /** Injectable so the arithmetic can be tested without a payroll table, and
   *  so the one place that reads pay rates stays visible from the call site. */
  readLabour: (admin: Db, businessId: string) => Promise<Record<string, number>> = labourCostByProject
): Promise<ProjectProfit[]> {
  const [projects, expenses, invoices, changeOrders] = await Promise.all([
    db
      .from("projects")
      .select("id, name, status, estimate_id, clients(name)")
      .eq("business_id", businessId)
      .order("name"),
    db.from("expenses").select("project_id, amount").eq("business_id", businessId),
    db.from("invoices").select("project_id, amount, status").eq("business_id", businessId),
    db
      .from("change_orders")
      .select("project_id, amount")
      .eq("business_id", businessId)
      .eq("status", "aprobado"),
  ]);

  const rows = (projects.data ?? []) as any[];

  // The estimate total is not a column on the project — it lives on the linked
  // estimate, and not every project has one.
  const estimateIds = rows.map((p) => p.estimate_id).filter(Boolean);
  const estimateTotals = new Map<string, number>();
  if (estimateIds.length > 0) {
    const { data } = await db.from("estimates").select("id, total").in("id", estimateIds);
    for (const e of (data ?? []) as any[]) estimateTotals.set(e.id, Number(e.total ?? 0));
  }

  // Labour needs the admin client: pay rates are deliberately unreadable
  // through a normal session, and this is a report only an admin can open.
  // A business with no rates configured gets zeros rather than an error —
  // rates are optional and a job with unknown labour cost is still worth
  // showing.
  let labourByProject: Record<string, number> = {};
  try {
    labourByProject = await readLabour(admin, businessId);
  } catch {
    labourByProject = {};
  }

  const sumBy = (list: any[], key: string, amount = "amount") => {
    const totals: Record<string, number> = {};
    for (const row of list ?? []) {
      const id = row[key];
      if (!id) continue;
      totals[id] = (totals[id] ?? 0) + Number(row[amount] ?? 0);
    }
    return totals;
  };

  const expenseTotals = sumBy((expenses.data ?? []) as any[], "project_id");
  const changeTotals = sumBy((changeOrders.data ?? []) as any[], "project_id");

  const invoicedTotals: Record<string, number> = {};
  const collectedTotals: Record<string, number> = {};
  for (const row of (invoices.data ?? []) as any[]) {
    if (!row.project_id) continue;
    const amount = Number(row.amount ?? 0);
    invoicedTotals[row.project_id] = (invoicedTotals[row.project_id] ?? 0) + amount;
    if (row.status === "pagado") {
      collectedTotals[row.project_id] = (collectedTotals[row.project_id] ?? 0) + amount;
    }
  }

  return rows.map((project) => {
    const base = project.estimate_id ? (estimateTotals.get(project.estimate_id) ?? 0) : 0;
    const contractValue = round(base + (changeTotals[project.id] ?? 0));
    const expensesTotal = round(expenseTotals[project.id] ?? 0);
    const labour = round(labourByProject[project.id] ?? 0);
    const cost = round(expensesTotal + labour);
    const invoiced = round(invoicedTotals[project.id] ?? 0);
    const collected = round(collectedTotals[project.id] ?? 0);
    const margin = round(contractValue - cost);

    return {
      projectId: project.id,
      name: project.name,
      clientName: project.clients?.name ?? null,
      status: project.status,
      contractValue,
      expenses: expensesTotal,
      labour,
      cost,
      invoiced,
      collected,
      margin,
      marginPercent: contractValue > 0 ? Math.round((margin / contractValue) * 1000) / 10 : null,
      // Never negative: invoicing above the contract means extras that were
      // agreed, not a debt the contract owes back.
      toInvoice: round(Math.max(0, contractValue - invoiced)),
      outstanding: round(Math.max(0, invoiced - collected)),
    };
  });
}
