import type { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Who owes money, and since when.
 *
 * The report every business has and this one did not. Most unpaid invoices in
 * a small contractor are not disputed — they are forgotten, by a client who
 * meant to pay and by a contractor with no list to look at. Sorting the debt
 * by age is what turns "we should chase some invoices" into a morning's work
 * with a beginning and an end.
 *
 * Age is counted from the due date, because that is the day the money became
 * late. An invoice with no due date is aged from the day it was issued: it was
 * payable on receipt, so that is when the clock started.
 */

type Admin = ReturnType<typeof getSupabaseAdmin>;

/** Where each bucket ends, in days overdue. The last one is open-ended. */
const BUCKET_EDGES = [30, 60, 90] as const;

export type BucketKey = "corriente" | "d1_30" | "d31_60" | "d61_90" | "d90_mas";

export interface AgedInvoice {
  id: string;
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
  projectName: string | null;
  type: string;
  description: string | null;
  amount: number;
  issuedAt: string;
  dueDate: string | null;
  /** Negative until the due date passes. */
  daysOverdue: number;
  bucket: BucketKey;
}

export interface ClientBalance {
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
  total: number;
  buckets: Record<BucketKey, number>;
  /** The oldest debt decides how hard this client is worth chasing. */
  oldestDaysOverdue: number;
  invoiceCount: number;
}

export interface ReceivablesReport {
  asOf: string;
  total: number;
  buckets: Record<BucketKey, number>;
  clients: ClientBalance[];
  invoices: AgedInvoice[];
  /** Money withheld by contract on invoices already paid. Owed, not late. */
  holdbackOutstanding: number;
}

const emptyBuckets = (): Record<BucketKey, number> => ({
  corriente: 0,
  d1_30: 0,
  d31_60: 0,
  d61_90: 0,
  d90_mas: 0,
});

const round = (value: number) => Math.round(value * 100) / 100;

/** Whole days between two dates, ignoring the time of day — an invoice due
 *  today is not late, whatever the hour. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

export function bucketFor(daysOverdue: number): BucketKey {
  if (daysOverdue <= 0) return "corriente";
  if (daysOverdue <= BUCKET_EDGES[0]) return "d1_30";
  if (daysOverdue <= BUCKET_EDGES[1]) return "d31_60";
  if (daysOverdue <= BUCKET_EDGES[2]) return "d61_90";
  return "d90_mas";
}

export async function receivables(admin: Admin, businessId: string, asOf = new Date()): Promise<ReceivablesReport> {
  const [unpaid, paid] = await Promise.all([
    admin
      .from("invoices")
      .select("id, client_id, type, description, amount, created_at, due_date, clients(name, email), projects(name)")
      .eq("business_id", businessId)
      .neq("status", "pagado")
      .order("due_date", { ascending: true, nullsFirst: false }),
    // The holdback sits on invoices that are already settled: the client paid
    // what was asked, and the rest is held by contract until the job closes.
    // Chasing it would be wrong; hiding it would understate what the business
    // is owed.
    admin
      .from("invoices")
      .select("holdback_amount, holdback_released")
      .eq("business_id", businessId),
  ]);

  const invoices: AgedInvoice[] = [];
  const byClient = new Map<string, ClientBalance>();
  const buckets = emptyBuckets();
  let total = 0;

  for (const row of (unpaid.data ?? []) as any[]) {
    const amount = Number(row.amount ?? 0);
    if (amount <= 0) continue;

    const from = new Date(row.due_date ?? row.created_at);
    const daysOverdue = daysBetween(from, asOf);
    const bucket = bucketFor(daysOverdue);

    invoices.push({
      id: row.id,
      clientId: row.client_id,
      clientName: row.clients?.name ?? null,
      clientEmail: row.clients?.email ?? null,
      projectName: row.projects?.name ?? null,
      type: row.type,
      description: row.description,
      amount: round(amount),
      issuedAt: row.created_at,
      dueDate: row.due_date,
      daysOverdue,
      bucket,
    });

    total = round(total + amount);
    buckets[bucket] = round(buckets[bucket] + amount);

    const existing = byClient.get(row.client_id);
    if (existing) {
      existing.total = round(existing.total + amount);
      existing.buckets[bucket] = round(existing.buckets[bucket] + amount);
      existing.oldestDaysOverdue = Math.max(existing.oldestDaysOverdue, daysOverdue);
      existing.invoiceCount += 1;
    } else {
      const fresh: ClientBalance = {
        clientId: row.client_id,
        clientName: row.clients?.name ?? null,
        clientEmail: row.clients?.email ?? null,
        total: round(amount),
        buckets: emptyBuckets(),
        oldestDaysOverdue: daysOverdue,
        invoiceCount: 1,
      };
      fresh.buckets[bucket] = round(amount);
      byClient.set(row.client_id, fresh);
    }
  }

  const withheld = ((paid.data ?? []) as any[]).reduce(
    (sum, row) => sum + Number(row.holdback_amount ?? 0) - Number(row.holdback_released ?? 0),
    0
  );

  return {
    asOf: asOf.toISOString(),
    total,
    buckets,
    // Oldest debt first: that is the order somebody making calls wants.
    clients: Array.from(byClient.values()).sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue),
    invoices,
    holdbackOutstanding: round(Math.max(0, withheld)),
  };
}
