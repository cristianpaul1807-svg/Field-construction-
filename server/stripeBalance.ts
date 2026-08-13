import type { getSupabaseAdmin } from "./supabaseAdmin";
import { getStripe } from "./stripe";

/**
 * The money that is at Stripe and on its way to the bank.
 *
 * The app knows what was invoiced and what Stripe says was paid. It does not
 * know what actually reached the bank account, and between the two sit the
 * processing fees, the deposit schedule, and refunds. A contractor looking at
 * "collected $10,000" and a bank statement showing $9,600 has no way to tell
 * whether the difference is normal.
 *
 * So this reports the three things separately: what is still settling, what is
 * ready to be paid out, and which deposits have already left — each with the
 * fee that was taken out of it.
 *
 * Everything is read from the connected account, which is where the money
 * actually is. This platform's own balance is not involved in any of it.
 */

type Admin = ReturnType<typeof getSupabaseAdmin>;

export interface Deposit {
  id: string;
  amount: number;
  currency: string;
  status: string;
  /** The day the bank should have it. */
  arrivalDate: string;
  /** Null until Stripe assigns one. */
  bankReference: string | null;
}

export interface BalanceSummary {
  connected: boolean;
  currency: string;
  /** Settled and payable. */
  available: number;
  /** Charged but not settled yet. */
  pending: number;
  /** Stripe's cut over the period, from the connected account's own ledger. */
  feesInPeriod: number;
  /** What the customers paid over the period, before fees. */
  chargedInPeriod: number;
  deposits: Deposit[];
  /** Set when Stripe will not pay out yet, with its own reason. */
  payoutsBlockedReason: string | null;
}

const money = (cents: number) => Math.round(cents) / 100;

export async function stripeBalance(
  admin: Admin,
  businessId: string,
  from: Date,
  to: Date
): Promise<BalanceSummary> {
  const { data: account } = await admin
    .from("stripe_connected_accounts")
    .select("stripe_account_id, payouts_enabled")
    .eq("business_id", businessId)
    .maybeSingle();

  if (!account?.stripe_account_id) {
    return {
      connected: false,
      currency: "cad",
      available: 0,
      pending: 0,
      feesInPeriod: 0,
      chargedInPeriod: 0,
      deposits: [],
      payoutsBlockedReason: null,
    };
  }

  const stripe = getStripe();
  const on = { stripeAccount: account.stripe_account_id };

  const [balance, payouts, ledger] = await Promise.all([
    stripe.balance.retrieve({}, on),
    stripe.payouts.list({ limit: 20 }, on),
    // The connected account's own ledger is the only honest source for what
    // Stripe took: the fee is not on the invoice, and reconstructing it from
    // published rates would drift the day those rates change.
    stripe.balanceTransactions.list(
      { limit: 100, created: { gte: Math.floor(from.getTime() / 1000), lte: Math.floor(to.getTime() / 1000) } },
      on
    ),
  ]);

  const currency = balance.available[0]?.currency ?? "cad";
  const sum = (entries: { amount: number; currency: string }[]) =>
    money(entries.filter((e) => e.currency === currency).reduce((total, e) => total + e.amount, 0));

  let feesInPeriod = 0;
  let chargedInPeriod = 0;
  for (const entry of ledger.data) {
    if (entry.currency !== currency) continue;
    feesInPeriod += entry.fee ?? 0;
    if (entry.type === "charge" || entry.type === "payment") chargedInPeriod += entry.amount;
  }

  return {
    connected: true,
    currency,
    available: sum(balance.available),
    pending: sum(balance.pending),
    feesInPeriod: money(feesInPeriod),
    chargedInPeriod: money(chargedInPeriod),
    deposits: payouts.data.map((payout) => ({
      id: payout.id,
      amount: money(payout.amount),
      currency: payout.currency,
      status: payout.status,
      arrivalDate: new Date(payout.arrival_date * 1000).toISOString().slice(0, 10),
      bankReference:
        typeof payout.statement_descriptor === "string" ? payout.statement_descriptor : null,
    })),
    // Money sitting at Stripe with no explanation is the kind of thing a
    // business notices at the worst moment. If Stripe is holding payouts, say
    // so on the same screen as the balance.
    payoutsBlockedReason: account.payouts_enabled === false ? "requisitos_pendientes" : null,
  };
}
