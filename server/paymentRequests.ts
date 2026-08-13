import type { getSupabaseAdmin } from "./supabaseAdmin";
import { contractValue } from "./paymentPlans";

/**
 * Asking a customer for money, in the conversation they are already in.
 *
 * The payment plan covers the stages agreed when the estimate was signed. This
 * is everything else — the extra approved on Tuesday, the progress payment
 * brought forward, the deposit on a job that never had a formal plan — and it
 * arrives as a message with a pay button rather than an email nobody opens.
 *
 * Two things make it more than a shortcut for creating an invoice:
 *
 * - It can be **scheduled**, because a contractor decides what to charge while
 *   they are thinking about the job, not on the day the money is due.
 * - It says **what the money is for**: agreed work, or extra. Without that the
 *   reports cannot tell a project running over budget from one that simply
 *   grew, which are opposite problems with opposite answers.
 *
 * A percentage stays a percentage until the moment it is sent, so a change
 * order approved in between moves the amount. Resolving it at creation would
 * quietly bill the old contract.
 */

type Admin = ReturnType<typeof getSupabaseAdmin>;

const round = (value: number) => Math.round(value * 100) / 100;

export type RequestKind = "proyecto" | "extra";
export type RequestBasis = "porcentaje" | "monto";

export interface PaymentRequestRow {
  id: string;
  business_id: string;
  client_id: string;
  project_id: string | null;
  kind: RequestKind;
  basis: RequestBasis;
  percent: number | null;
  amount: number | null;
  description: string | null;
  status: string;
  send_at: string | null;
}

/**
 * What this request is worth right now.
 *
 * A percentage with no project has nothing to be a percentage of, and returns
 * zero rather than guessing — the caller refuses to send it and says why.
 */
export async function resolveAmount(admin: Admin, request: PaymentRequestRow): Promise<number> {
  if (request.basis === "monto") return round(Number(request.amount ?? 0));
  if (!request.project_id) return 0;
  const total = await contractValue(admin, request.business_id, request.project_id);
  return round(total * (Number(request.percent ?? 0) / 100));
}

export interface SendResult {
  invoiceId: string;
  messageId: string;
  amount: number;
}

/**
 * Turns a request into a real invoice and puts it in front of the customer.
 *
 * Idempotent by status: only a `programado` row is sent, so a scheduler firing
 * twice, a double click, and a retried request all produce one charge. That
 * matters more here than almost anywhere else in the product — a duplicate
 * invoice is a phone call from an angry customer.
 */
export async function sendPaymentRequest(
  admin: Admin,
  requestId: string,
  deps: {
    createInvoice: (args: {
      businessId: string;
      clientId: string;
      projectId: string | null;
      type: "deposito" | "parcial" | "final";
      chargeKind: RequestKind;
      subtotal: number;
      description: string;
    }) => Promise<string>;
    postToChat: (args: {
      businessId: string;
      clientId: string;
      invoiceId: string;
      content: string;
    }) => Promise<string>;
  }
): Promise<SendResult | null> {
  const { data: request } = await admin
    .from("payment_requests")
    .select("id, business_id, client_id, project_id, kind, basis, percent, amount, description, status, send_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.status !== "programado") return null;

  const amount = await resolveAmount(admin, request as PaymentRequestRow);
  if (amount <= 0) return null;

  const description =
    request.description?.trim() ||
    (request.basis === "porcentaje" ? `${Number(request.percent)}%` : "");

  const invoiceId = await deps.createInvoice({
    businessId: request.business_id,
    clientId: request.client_id,
    projectId: request.project_id,
    // Never "final": a request is an ask along the way, and typing it final
    // would release the holdback that the real closing invoice has to settle.
    type: "parcial",
    chargeKind: request.kind as RequestKind,
    subtotal: amount,
    description,
  });

  const messageId = await deps.postToChat({
    businessId: request.business_id,
    clientId: request.client_id,
    invoiceId,
    content: description,
  });

  const { error } = await admin
    .from("payment_requests")
    .update({
      status: "enviado",
      sent_at: new Date().toISOString(),
      invoice_id: invoiceId,
      chat_message_id: messageId,
    })
    .eq("id", request.id)
    // Only if still scheduled: two concurrent sends cannot both win.
    .eq("status", "programado");
  if (error) throw error;

  return { invoiceId, messageId, amount };
}

/**
 * Sends everything whose time has come.
 *
 * Called from ordinary traffic rather than a cron, because this product has no
 * scheduler and inventing one for this would be a lot of moving parts for a
 * feature whose worst case is a few minutes late. The customer opening their
 * portal is itself a trigger, which is exactly when a waiting request wants to
 * be seen. The admin can always send one by hand.
 *
 * Never throws into the caller: a request that failed to go out must not break
 * the page somebody was actually loading.
 */
export async function sweepDueRequests(
  admin: Admin,
  businessId: string,
  deps: Parameters<typeof sendPaymentRequest>[2]
): Promise<number> {
  try {
    const { data } = await admin
      .from("payment_requests")
      .select("id")
      .eq("business_id", businessId)
      .eq("status", "programado")
      .not("send_at", "is", null)
      .lte("send_at", new Date().toISOString())
      .limit(20);

    let sent = 0;
    for (const row of data ?? []) {
      const result = await sendPaymentRequest(admin, row.id, deps);
      if (result) sent += 1;
    }
    return sent;
  } catch (err) {
    console.error("[paymentRequests] sweep failed", businessId, err);
    return 0;
  }
}

/** Marks the request paid when its invoice is. Called from the Stripe webhook. */
export async function markRequestPaidByInvoice(admin: Admin, invoiceId: string): Promise<void> {
  const { error } = await admin
    .from("payment_requests")
    .update({ status: "pagado" })
    .eq("invoice_id", invoiceId)
    .eq("status", "enviado");
  if (error) console.error("[paymentRequests] could not mark paid", invoiceId, error);
}
