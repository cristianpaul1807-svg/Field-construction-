import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { getSupabaseAdmin } from "./supabaseAdmin";

export const STRIPE_PRICE_IDS = {
  chantier_month: "price_1UGhMxCoxo1rqCJcc3GAVUcV",
  chantier_year: "price_1UGhMxCoxo1rqCJcN60TxdoV",
  entreprise_month: "price_1UGhMoCoxo1rqCJcwQwwJPvw",
  entreprise_year: "price_1UGhMoCoxo1rqCJcmVnHAMMn",
} as const;

export type SubscriptionState =
  | "trialing"
  | "active"
  | "payment_failed"
  | "cancelled"
  | "suspended"
  | "pending_deletion"
  | "deleted";

export function planFromPriceId(priceId: string | null | undefined): "chantier" | "entreprise" | null {
  if (priceId === STRIPE_PRICE_IDS.chantier_month || priceId === STRIPE_PRICE_IDS.chantier_year) return "chantier";
  if (priceId === STRIPE_PRICE_IDS.entreprise_month || priceId === STRIPE_PRICE_IDS.entreprise_year) return "entreprise";
  return null;
}

export function intervalFromPriceId(priceId: string | null | undefined): "month" | "year" | null {
  if (priceId === STRIPE_PRICE_IDS.chantier_month || priceId === STRIPE_PRICE_IDS.entreprise_month) return "month";
  if (priceId === STRIPE_PRICE_IDS.chantier_year || priceId === STRIPE_PRICE_IDS.entreprise_year) return "year";
  return null;
}

export function subscriptionIsOperational(status: string | null | undefined, trialEndsAt: string | null | undefined): boolean {
  if (!status) return true; // legacy pilot/fondateur businesses remain operational
  if (status === "active" || status === "trialing") return true;
  return false;
}

export async function retrieveSubscription(id: string): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.retrieve(id);
}

export async function updateBusinessSubscription(
  businessId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await getSupabaseAdmin().from("businesses").update(patch).eq("id", businessId);
  if (error) throw error;
}

export async function findBusinessByStripeCustomer(customerId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("businesses")
    .select("id, name, email, subscription_plan, subscription_status, subscription_language")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findBusinessByStripeSubscription(subscriptionId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("businesses")
    .select("id, name, email, subscription_plan, subscription_status, subscription_language")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function unixToIso(value: number | null | undefined): string | null {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

export function subscriptionPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
}

export function subscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  const end = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return unixToIso(end);
}
