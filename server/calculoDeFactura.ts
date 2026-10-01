/**
 * Cuánto es una factura: el impuesto, la retención y lo que queda por pagar.
 *
 * Vive aparte de `api.ts` porque lo usan dos sitios que tienen que dar la
 * misma cifra: la emisión de la factura (`createInvoiceRecord`) y el MCP,
 * cuando alguien le pregunta a Claude «¿cuánto sería la factura del acconto?».
 * Si cada uno hiciera su cuenta, un día la respuesta hablada y la factura
 * impresa dirían números distintos, y la que vale es la impresa.
 */

import type { getSupabaseAdmin } from "./supabaseAdmin";
import { calcularIva, esOpcionIva, IVA_POR_DEFECTO, type OpcionIva } from "../shared/iva";
import { esPaisConocido, paisDe } from "../shared/paises";

type Admin = ReturnType<typeof getSupabaseAdmin>;

/** Al céntimo, una sola vez, como el resto del dinero de este producto. */
const alCentimo = (n: number) => Math.round(n * 100) / 100;

export async function computeInvoiceTax(
  admin: Admin,
  businessId: string,
  subtotal: number,
  /** Sólo en Italia: el IVA de esta factura. Sin él, el del negocio. */
  opcionIva?: unknown
): Promise<{ taxAmount: number; breakdown: Record<string, unknown> }> {
  const { data: business, error: businessError } = await admin
    .from("businesses")
    .select("province, country, tax_config")
    .eq("id", businessId)
    .single();
  if (businessError) throw businessError;

  // El país primero, siempre. Las siglas se repiten entre países —«PE» es
  // Pescara y también la Isla del Príncipe Eduardo— y buscar la provincia en
  // la tabla de Canadá sin mirar el país le pondría a una factura italiana el
  // impuesto de otro continente.
  // Un país que todavía no sabemos hacer no tiene impuesto: ni el de Canadá
  // ni ninguno inventado. Se marca, y las facturas esperan (ver
  // `createInvoiceRecord`); lo que sigue funcionando son los presupuestos y
  // su total antes de impuestos.
  if (business.country && paisDe(business.country).impuestos === "sin_configurar") {
    return { taxAmount: 0, breakdown: { country: business.country, sinConfigurar: true } };
  }

  if (esPaisConocido(business.country) && paisDe(business.country).impuestos === "italia") {
    const delNegocio = (business.tax_config as { ivaPredefinita?: unknown } | null)?.ivaPredefinita;
    const opcion: OpcionIva = esOpcionIva(opcionIva) ? opcionIva : esOpcionIva(delNegocio) ? delNegocio : IVA_POR_DEFECTO;
    const { taxAmount, breakdown } = calcularIva(subtotal, opcion);
    return { taxAmount, breakdown: breakdown as unknown as Record<string, unknown> };
  }

  const { data: rate, error: rateError } = await admin
    .from("canada_tax_rates")
    .select("province, label, is_hst, gst_rate, pst_rate, hst_rate")
    .eq("province", business.province)
    .single();
  if (rateError) throw rateError;

  if (rate.is_hst) {
    const hst = alCentimo(subtotal * Number(rate.hst_rate));
    return { taxAmount: hst, breakdown: { province: rate.province, hst } };
  }
  const gst = alCentimo(subtotal * Number(rate.gst_rate));
  const pst = alCentimo(subtotal * Number(rate.pst_rate));
  return { taxAmount: alCentimo(gst + pst), breakdown: { province: rate.province, gst, pst } };
}

export type TipoDeFactura = "deposito" | "parcial" | "final";

/**
 * La factura entera, sin guardarla.
 *
 * Devuelve lo mismo que acabaría en la fila de `invoices`. Quien la emite lo
 * guarda; quien sólo pregunta lo lee y no pasa nada más.
 */
export async function calcularFactura(
  admin: Admin,
  input: { businessId: string; subtotal: number; type: TipoDeFactura; projectId: string | null; iva?: unknown }
): Promise<{
  taxAmount: number;
  breakdown: Record<string, unknown>;
  holdbackPercent: number;
  holdbackAmount: number;
  holdbackReleased: number;
  amount: number;
}> {
  const { taxAmount, breakdown } = await computeInvoiceTax(admin, input.businessId, input.subtotal, input.iva);

  // The holdback is withheld from progress payments, not from the final one —
  // the final invoice is where the withheld money is released, so applying it
  // there would hold the same money back twice.
  const { data: business } = await admin
    .from("businesses")
    .select("holdback_percent")
    .eq("id", input.businessId)
    .single();
  const holdbackPercent = input.type === "final" ? 0 : Number(business?.holdback_percent ?? 0);
  const holdbackAmount = alCentimo(input.subtotal * (holdbackPercent / 100));

  // The final invoice collects everything held back along the way.
  //
  // Not doing this was a real hole: each progress invoice subtracted its 10%
  // and the final one merely stopped subtracting more, so on a $100,000 job
  // billed 50/25/25 the contractor invoiced $92,500 and never asked for the
  // rest. Nobody would notice from inside the software — every invoice looked
  // right on its own.
  //
  // It carries no tax. The tax was charged on the full value of the work when
  // that work was first invoiced; the holdback only ever delayed the payment
  // of principal, so taxing it here would charge it twice.
  let holdbackReleased = 0;
  if (input.type === "final" && input.projectId) {
    const { data: earlier } = await admin
      .from("invoices")
      .select("holdback_amount, holdback_released")
      .eq("business_id", input.businessId)
      .eq("project_id", input.projectId);
    const withheld = (earlier ?? []).reduce((sum, row) => sum + Number(row.holdback_amount ?? 0), 0);
    const alreadyReleased = (earlier ?? []).reduce((sum, row) => sum + Number(row.holdback_released ?? 0), 0);
    // Subtracting what was already given back keeps this correct even if a
    // project somehow ends up with two closing invoices.
    holdbackReleased = Math.max(0, alCentimo(withheld - alreadyReleased));
  }

  return {
    taxAmount,
    breakdown,
    holdbackPercent,
    holdbackAmount,
    holdbackReleased,
    // Tax is charged on the full value of the work; only the payment is
    // reduced by the holdback, which is why it is subtracted last. The
    // release is added after tax for the same reason it carries none.
    amount: alCentimo(input.subtotal + taxAmount - holdbackAmount + holdbackReleased),
  };
}
