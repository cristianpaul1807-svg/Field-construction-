import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { renovacionIso } from "../shared/suscripcionStripe";

/**
 * Los cuatro precios con los que se vendió antes de que esto mirara la clave
 * de búsqueda.
 *
 * Ya no se usan para cobrar: la pasarela busca el precio por `lookup_key`, que
 * es igual en todas las cuentas. Siguen aquí sólo para **entender** una
 * suscripción vendida con ellos, porque el día que cambiamos de cuenta de
 * Stripe no se puede dejar de reconocer a quien lleva un año pagando.
 *
 * No se les añade nada. Un precio nuevo nace del script con su clave.
 */
export const PRECIOS_HEREDADOS: Record<string, "chantier" | "entreprise"> = {
  price_1UGhMxCoxo1rqCJcc3GAVUcV: "chantier",
  price_1UGhMxCoxo1rqCJcN60TxdoV: "chantier",
  price_1UGhMoCoxo1rqCJcwQwwJPvw: "entreprise",
  price_1UGhMoCoxo1rqCJcmVnHAMMn: "entreprise",
};

export type SubscriptionState =
  | "trialing"
  | "active"
  | "payment_failed"
  | "cancelled"
  | "suspended"
  | "pending_deletion"
  | "deleted";

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

export function subscriptionPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
}

/** Ver `shared/renovacion.ts`: el campo está en dos sitios y esto es el porqué. */
export function subscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  return renovacionIso(subscription);
}
