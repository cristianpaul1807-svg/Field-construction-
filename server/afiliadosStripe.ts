/**
 * La parte de Stripe del programa de afiliados: de qué cobro sale cada
 * comisión, la cuenta en la que cobra el afiliado y la transferencia.
 *
 * Aparte de `afiliados.ts` porque aquí todo habla con Stripe y allí todo con
 * la base de datos; así cada mitad se puede leer sin la otra.
 */
import type Stripe from "stripe";

/** La versión con la que se crean las cuentas v2. La misma que el resto del Connect. */
const STRIPE_V2_VERSION = "2026-06-24.preview";

type Factura = {
  id?: string;
  currency?: string | null;
  subtotal?: number | null;
  total_excluding_tax?: number | null;
  amount_paid?: number | null;
};

/**
 * Sobre cuánto se calcula la comisión, en dólares canadienses.
 *
 * Sin impuestos: el afiliado se lleva un porcentaje de lo nuestro, no de lo
 * que le pasamos a Revenu Québec o a la Agenzia delle Entrate.
 *
 * En dólares canadienses porque es la moneda en la que Stripe liquida a la
 * plataforma y desde la que se le transfiere al afiliado. Una suscripción en
 * euros se lleva a lo que de verdad entró en la cuenta (la transacción del
 * saldo), no a un cambio inventado aquí.
 *
 * Devuelve `null` si no se puede saber: mejor no apuntar una comisión que
 * apuntar una mal calculada. Se grita en el registro para rehacerla a mano.
 */
export async function baseDelCobroEnCad(stripe: Stripe, factura: Factura): Promise<number | null> {
  const centimosSinImpuestos = factura.total_excluding_tax ?? factura.subtotal ?? 0;
  if (!factura.id || centimosSinImpuestos <= 0) return null;
  if ((factura.currency ?? "cad").toLowerCase() === "cad") return Math.round(centimosSinImpuestos) / 100;

  try {
    const pagos = await stripe.invoicePayments.list({ invoice: factura.id, limit: 1 });
    const intento = pagos.data[0]?.payment?.payment_intent;
    const intentoId = typeof intento === "string" ? intento : intento?.id;
    if (!intentoId) throw new Error("la factura no tiene PaymentIntent");
    const pi = await stripe.paymentIntents.retrieve(intentoId, { expand: ["latest_charge.balance_transaction"] });
    const cargo = pi.latest_charge as Stripe.Charge | null;
    const movimiento = cargo?.balance_transaction as Stripe.BalanceTransaction | null;
    if (!movimiento || movimiento.currency.toLowerCase() !== "cad") throw new Error("el saldo no se liquidó en CAD");
    // La parte sin impuestos de lo que entró, en la misma proporción.
    const pagado = factura.amount_paid ?? 0;
    const proporcion = pagado > 0 ? centimosSinImpuestos / pagado : 1;
    return Math.round(movimiento.amount * proporcion) / 100;
  } catch (err) {
    console.error(`[afiliados] no se pudo llevar a CAD el cobro ${factura.id}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * La factura de suscripción que pagó un PaymentIntent. Para saber de qué
 * comisión es un reembolso o un contracargo, que llegan con el cobro y no
 * con la factura (el campo `charge.invoice` ya no existe en esta versión de
 * la API).
 */
export async function facturaDelPago(stripe: Stripe, paymentIntentId: string | null | undefined): Promise<string | null> {
  if (!paymentIntentId) return null;
  try {
    const pagos = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: paymentIntentId }, limit: 1 });
    const factura = pagos.data[0]?.invoice;
    return typeof factura === "string" ? factura : factura?.id ?? null;
  } catch (err) {
    console.error("[afiliados] no se encontró la factura del pago", paymentIntentId, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * La cuenta en la que cobra un afiliado.
 *
 * Sólo recibe transferencias (configuración `recipient`): un afiliado no le
 * cobra a nadie, así que pedirle lo que se le pide a un comercio sería
 * papeleo para nada. Panel Express, para que vea sus pagos y su banco sin
 * pasar por nosotros. Particular, en su país: el país de una cuenta de
 * Stripe no se cambia nunca, por eso se pregunta en el panel y no se adivina.
 */
export async function crearCuentaDeCobro(
  stripe: Stripe,
  datos: { nombre: string; email: string | null; pais: string }
): Promise<string> {
  const cuenta = (await stripe.v2.core.accounts.create(
    {
      display_name: datos.nombre,
      contact_email: datos.email ?? undefined,
      dashboard: "express",
      identity: { country: datos.pais.toLowerCase(), entity_type: "individual" },
      configuration: {
        recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      },
      defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
      include: ["configuration.recipient", "identity", "requirements"],
    } as never,
    { apiVersion: STRIPE_V2_VERSION } as never
  )) as unknown as { id: string };
  return cuenta.id;
}

/** El enlace de Stripe para que el afiliado complete su cuenta de cobro. */
export async function enlaceDeAltaDeCobro(stripe: Stripe, cuentaId: string, base: string): Promise<string> {
  const enlace = (await stripe.v2.core.accountLinks.create(
    {
      account: cuentaId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          // Rutas que existen en client/src/App.tsx.
          refresh_url: `${base}/afiliados/panel`,
          return_url: `${base}/afiliados/panel?cobro=listo`,
        },
      },
    } as never,
    { apiVersion: STRIPE_V2_VERSION } as never
  )) as unknown as { url: string };
  return enlace.url;
}

/** Si la cuenta ya puede recibir transferencias. */
export async function puedeRecibir(stripe: Stripe, cuentaId: string): Promise<boolean> {
  try {
    const cuenta = (await stripe.v2.core.accounts.retrieve(
      cuentaId,
      { include: ["configuration.recipient"] } as never,
      { apiVersion: STRIPE_V2_VERSION } as never
    )) as unknown as {
      configuration?: { recipient?: { capabilities?: { stripe_balance?: { stripe_transfers?: { status?: string } } } } };
    };
    return cuenta.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
  } catch (err) {
    console.error("[afiliados] no se pudo leer la cuenta de cobro", cuentaId, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Mandarle el dinero. La clave de idempotencia es el pago: si la petición se
 * repite (un reintento, un doble clic que pasó la reserva), Stripe devuelve
 * la misma transferencia y no hace otra.
 */
export async function transferir(stripe: Stripe, cuentaId: string, importeCad: number, pagoId: string): Promise<string> {
  const transferencia = await stripe.transfers.create(
    {
      amount: Math.round(importeCad * 100),
      currency: "cad",
      destination: cuentaId,
      description: "Logiciel Construction — commissions d'affiliation",
      metadata: { pago_afiliado: pagoId },
    },
    { idempotencyKey: `pago-afiliado-${pagoId}` }
  );
  return transferencia.id;
}
