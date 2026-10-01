/**
 * El XML FatturaPA de una factura o de una nota de crédito ya emitida.
 *
 * Aquí sólo se reúnen los datos; el XML lo escribe `shared/fatturaPA.ts`, que
 * es puro y se valida contra el esquema oficial en
 * `scripts/prueba-italia/fatturapa.mjs`.
 *
 * Si falta algo —la Partita IVA del negocio, la dirección del cliente— no se
 * genera nada: se devuelve la lista exacta de lo que falta y de quién, para
 * que la pantalla lleve a rellenarlo. Un XML incompleto el SDI lo rechaza
 * días después, y entonces el problema ya es de un cliente esperando.
 */

import type { getSupabaseAdmin } from "./supabaseAdmin";
import {
  faltaDelNegocio,
  faltaParaFatturaPA,
  generarFatturaPA,
  nombreDelArchivo,
  progresivoDe,
  type DatosDelNegocio,
  type FaltaDelCliente,
  type FaltaDelNegocio,
} from "../shared/fatturaPA";
import { esDesgloseIva } from "../shared/iva";
import { paisDe } from "../shared/paises";
import { fechaEnZona } from "../shared/zonaHoraria";
import { esBonusFiscale, RIFERIMENTO_NORMATIVO } from "../shared/bonusEdilizi";

type Admin = ReturnType<typeof getSupabaseAdmin>;

export type ResultadoFatturaPA =
  | { ok: true; xml: string; nombre: string }
  | { ok: false; code: "fatturapa_solo_italia" | "fatturapa_no_encontrada" | "fatturapa_anulada" | "fatturapa_sin_iva" }
  | { ok: false; code: "fatturapa_datos_incompletos"; faltan: { negocio: FaltaDelNegocio[]; cliente: FaltaDelCliente[] }; clientId: string | null };

const CONCEPTO: Record<string, string> = { deposito: "Acconto", parcial: "Stato avanzamento lavori", final: "Saldo lavori" };
const SELECT_CLIENTE = "id, name, partita_iva, codice_fiscale, codice_destinatario, pec, address_line, postal_code, city, region, country";

async function negocioDe(admin: Admin, businessId: string) {
  const { data } = await admin
    .from("businesses")
    .select("name, country, partita_iva, codice_fiscale, address_line, postal_code, city, province, regime_fiscale")
    .eq("id", businessId)
    .maybeSingle();
  return data;
}

function aDatosDelNegocio(n: NonNullable<Awaited<ReturnType<typeof negocioDe>>>): DatosDelNegocio {
  return {
    nombre: n.name,
    partitaIva: n.partita_iva ?? null,
    codiceFiscale: n.codice_fiscale ?? null,
    addressLine: n.address_line ?? null,
    postalCode: n.postal_code ?? null,
    city: n.city ?? null,
    province: n.province ?? null,
    regimeFiscale: n.regime_fiscale ?? null,
  };
}

function aDatosDelCliente(c: any) {
  return {
    nombre: c?.name ?? "",
    partitaIva: c?.partita_iva ?? null,
    codiceFiscale: c?.codice_fiscale ?? null,
    codiceDestinatario: c?.codice_destinatario ?? null,
    pec: c?.pec ?? null,
    addressLine: c?.address_line ?? null,
    postalCode: c?.postal_code ?? null,
    city: c?.city ?? null,
    region: c?.region ?? null,
    country: c?.country ?? null,
  };
}

export async function fatturaPADeFactura(admin: Admin, businessId: string, invoiceId: string): Promise<ResultadoFatturaPA> {
  const negocio = await negocioDe(admin, businessId);
  if (!negocio || paisDe(negocio.country).impuestos !== "italia") return { ok: false, code: "fatturapa_solo_italia" };

  const { data: f } = await admin
    .from("invoices")
    .select(`id, number, type, status, description, subtotal, tax_breakdown, holdback_amount, holdback_released, amount, due_date, created_at, client_id, clients(${SELECT_CLIENTE}), projects(name, bonus_fiscale)`)
    .eq("business_id", businessId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (!f || !f.number) return { ok: false, code: "fatturapa_no_encontrada" };
  // Una factura anulada no viaja: en Italia lo emitido se corrige con una
  // nota de crédito, no desapareciendo.
  if (f.status === "cancelado") return { ok: false, code: "fatturapa_anulada" };
  if (!esDesgloseIva(f.tax_breakdown)) return { ok: false, code: "fatturapa_sin_iva" };

  const datosNegocio = aDatosDelNegocio(negocio);
  const cliente = aDatosDelCliente(f.clients);
  const faltan = { negocio: faltaDelNegocio(datosNegocio), cliente: faltaParaFatturaPA(cliente) };
  if (faltan.negocio.length || faltan.cliente.length) {
    return { ok: false, code: "fatturapa_datos_incompletos", faltan, clientId: f.client_id ?? null };
  }

  const proyecto = (f.projects as unknown as { name?: string } | null)?.name;
  // Con bonus, la factura dice a qué deducción corresponde: es lo primero que
  // mira quien revisa la detrazione del cliente.
  const bonus = (f.projects as unknown as { bonus_fiscale?: string | null } | null)?.bonus_fiscale;
  const causaliExtra = esBonusFiscale(bonus) ? [`Lavori agevolati ai sensi dell'${RIFERIMENTO_NORMATIVO[bonus]}`] : [];
  const entrada = {
    negocio: datosNegocio,
    cliente,
    progressivo: progresivoDe(f.number, false),
    documento: {
      tipo: f.type === "deposito" ? ("acconto" as const) : ("fattura" as const),
      numero: f.number,
      data: fechaEnZona(new Date(f.created_at), "Europe/Rome"),
      imponibile: Number(f.subtotal),
      desglose: f.tax_breakdown,
      descrizione: [f.description || CONCEPTO[f.type] || "", proyecto ? `Cantiere: ${proyecto}` : ""].filter(Boolean).join(" - "),
      importoPagamento: Number(f.amount),
      scadenza: f.due_date ?? null,
      ritenutaAGaranzia: Number(f.holdback_amount ?? 0),
      ritenutaSvincolata: Number(f.holdback_released ?? 0),
      causaliExtra,
    },
  };
  return { ok: true, xml: generarFatturaPA(entrada), nombre: nombreDelArchivo(entrada) };
}

export async function fatturaPADeNota(admin: Admin, businessId: string, noteId: string): Promise<ResultadoFatturaPA> {
  const negocio = await negocioDe(admin, businessId);
  if (!negocio || paisDe(negocio.country).impuestos !== "italia") return { ok: false, code: "fatturapa_solo_italia" };

  const { data: n } = await admin
    .from("credit_notes")
    .select(`id, number, reason, subtotal, tax_breakdown, created_at, invoices(number, created_at, client_id, clients(${SELECT_CLIENTE}))`)
    .eq("business_id", businessId)
    .eq("id", noteId)
    .maybeSingle();
  const factura = n?.invoices as unknown as { number: string | null; created_at: string; client_id: string | null; clients: unknown } | null;
  if (!n || !n.number || !factura?.number) return { ok: false, code: "fatturapa_no_encontrada" };
  if (!esDesgloseIva(n.tax_breakdown)) return { ok: false, code: "fatturapa_sin_iva" };

  const datosNegocio = aDatosDelNegocio(negocio);
  const cliente = aDatosDelCliente(factura.clients);
  const faltan = { negocio: faltaDelNegocio(datosNegocio), cliente: faltaParaFatturaPA(cliente) };
  if (faltan.negocio.length || faltan.cliente.length) {
    return { ok: false, code: "fatturapa_datos_incompletos", faltan, clientId: factura.client_id ?? null };
  }

  const numero = `NC-${n.number}`;
  const entrada = {
    negocio: datosNegocio,
    cliente,
    progressivo: progresivoDe(n.number, true),
    documento: {
      tipo: "nota_di_credito" as const,
      numero,
      data: fechaEnZona(new Date(n.created_at), "Europe/Rome"),
      imponibile: Number(n.subtotal),
      desglose: n.tax_breakdown,
      descrizione: n.reason || `Nota di credito sulla fattura ${factura.number}`,
      importoPagamento: 0,
      scadenza: null,
      ritenutaAGaranzia: 0,
      ritenutaSvincolata: 0,
      fatturaCollegata: { numero: factura.number, data: fechaEnZona(new Date(factura.created_at), "Europe/Rome") },
    },
  };
  return { ok: true, xml: generarFatturaPA(entrada), nombre: nombreDelArchivo(entrada) };
}
