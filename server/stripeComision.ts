import Stripe from "stripe";
import { getStripe } from "./stripe";
import type { getSupabaseAdmin } from "./supabaseAdmin";

type Admin = ReturnType<typeof getSupabaseAdmin>;

/**
 * Lo que Stripe se queda de cada cobro.
 *
 * Una factura de 5 748,75 $ cobrada con tarjeta no deja 5 748,75 $ en el banco.
 * Stripe se lleva su comisión antes de depositar, y en Canadá esa comisión
 * lleva TPS y TVQ encima porque es un servicio facturado al contratista. Sin
 * apuntarlo pasan dos cosas, las dos malas: el beneficio que enseña el sistema
 * es mayor que el real, y el contable no puede cuadrar el depósito con la
 * factura porque los importes no coinciden y nadie sabe por qué.
 *
 * El impuesto de la comisión se guarda aparte a propósito. No es un gasto: es
 * un crédito de impuesto que el contratista recupera en su declaración, y
 * sumado a la comisión se pierde para siempre.
 *
 * El dato sale del **libro mayor de la cuenta conectada**, nunca de las tarifas
 * publicadas. Es la única fuente honesta: la comisión no viene en la factura, y
 * reconstruirla de la tarifa se desvía el día que Stripe la cambia o el día que
 * paga una tarjeta extranjera, que lleva recargo.
 */

/** Cuánto sumó cada concepto dentro de la comisión. */
function repartirComision(bt: Stripe.BalanceTransaction): { total: number; impuesto: number } {
  let impuesto = 0;
  for (const detalle of bt.fee_details ?? []) {
    // Stripe llama `tax` a la TPS/TVQ que cobra sobre su propio servicio.
    if (detalle.type === "tax") impuesto += detalle.amount;
  }
  return { total: bt.fee ?? 0, impuesto };
}

const enDinero = (centavos: number) => Math.round(centavos) / 100;

/**
 * Apunta en el cobro lo que Stripe se llevó.
 *
 * Devuelve `false` cuando todavía no se puede saber. Eso no es un fallo: en el
 * momento en que llega el webhook la transacción puede estar aún sin asentar, y
 * entonces el dato no existe en ningún sitio. Se vuelve a intentar solo.
 */
export async function capturarComision(admin: Admin, businessId: string, paymentId: string): Promise<boolean> {
  const { data: pago } = await admin
    .from("payments")
    .select("id, method, stripe_payment_id, stripe_fee")
    .eq("business_id", businessId)
    .eq("id", paymentId)
    .maybeSingle();
  if (!pago || pago.method !== "stripe" || !pago.stripe_payment_id) return false;
  if (pago.stripe_fee !== null && pago.stripe_fee !== undefined) return true;

  const { data: cuenta } = await admin
    .from("stripe_connected_accounts")
    .select("stripe_account_id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!cuenta?.stripe_account_id) return false;

  const stripe = getStripe();
  // Cargos directos: el cobro y su comisión viven en la cuenta del
  // contratista, no en la nuestra. Preguntar sin `stripeAccount` devolvería
  // que no existe.
  const en = { stripeAccount: cuenta.stripe_account_id };

  const bt = await transaccionDelCobro(stripe, pago.stripe_payment_id, en);
  if (!bt) return false;

  const { total, impuesto } = repartirComision(bt);
  await admin
    .from("payments")
    .update({
      stripe_fee: enDinero(total),
      stripe_fee_tax: enDinero(impuesto),
      stripe_net: enDinero(bt.net ?? 0),
      stripe_balance_txn_id: bt.id,
    })
    .eq("id", paymentId)
    .eq("business_id", businessId);
  return true;
}

/**
 * La transacción del libro mayor detrás de un cobro.
 *
 * Lo que guardamos es el `payment_intent` casi siempre, pero no siempre: si
 * Stripe no llegó a dar uno se guardó el id de la sesión de pago. Se prueban
 * los dos caminos antes de decir que no hay dato.
 */
async function transaccionDelCobro(
  stripe: Stripe,
  id: string,
  en: { stripeAccount: string }
): Promise<Stripe.BalanceTransaction | null> {
  try {
    if (id.startsWith("pi_")) {
      const pi = await stripe.paymentIntents.retrieve(id, { expand: ["latest_charge.balance_transaction"] }, en);
      const cargo = pi.latest_charge as Stripe.Charge | null;
      const bt = cargo?.balance_transaction;
      return typeof bt === "object" && bt !== null ? bt : null;
    }
    if (id.startsWith("cs_")) {
      const sesion = await stripe.checkout.sessions.retrieve(
        id,
        { expand: ["payment_intent.latest_charge.balance_transaction"] },
        en
      );
      const pi = sesion.payment_intent as Stripe.PaymentIntent | null;
      const cargo = pi?.latest_charge as Stripe.Charge | null;
      const bt = cargo?.balance_transaction;
      return typeof bt === "object" && bt !== null ? bt : null;
    }
  } catch {
    // Un cobro que Stripe ya no reconoce no puede tumbar nada de lo que venga
    // detrás. Se queda sin comisión apuntada y el reintento lo verá otra vez.
    return null;
  }
  return null;
}

/**
 * Los cobros con tarjeta a los que todavía les falta la comisión.
 *
 * Se mira de vez en cuando porque el dato aparece minutos después del cobro:
 * en el momento del webhook la transacción puede no estar asentada. Sin esto,
 * la comisión de un cobro llegaría a faltar para siempre por haber preguntado
 * medio minuto antes de tiempo.
 */
export async function cobrosSinComision(admin: Admin, businessId: string, limite = 25): Promise<string[]> {
  const { data } = await admin
    .from("payments")
    .select("id")
    .eq("business_id", businessId)
    .eq("method", "stripe")
    .not("stripe_payment_id", "is", null)
    .is("stripe_fee", null)
    .order("paid_at", { ascending: false })
    .limit(limite);
  return (data ?? []).map((fila: { id: string }) => fila.id);
}
