/**
 * Los SAL de una obra: leerlos, y certificar uno nuevo.
 *
 * La cuenta la hace `shared/sal.ts`; aquí se reúne lo que necesita —las
 * partidas del presupuesto aceptado, los extras aprobados, el SAL anterior y
 * el anticipo facturado— y se guarda el resultado. La factura de un SAL la
 * emite `server/api.ts`, que es donde vive la única función que crea facturas.
 */

import type { getSupabaseAdmin } from "./supabaseAdmin";
import { calcolaSal, righeDelContratto, type CalcoloSal, type RigaContratto, type RigaSal } from "../shared/sal";
import { esDesgloseIva, type OpcionIva } from "../shared/iva";

type Admin = ReturnType<typeof getSupabaseAdmin>;

export interface SalGuardado {
  id: string;
  numero: number;
  data: string;
  importoCumulato: number;
  importo: number;
  recuperoAcconto: number;
  note: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
}

export interface EstadoSal {
  /** Las partidas con lo ejecutado según el último SAL. */
  righe: (RigaContratto & { percentualePrecedente: number })[];
  contratto: number;
  /** El anticipo facturado en la obra, sin impuestos. */
  acconti: number;
  accontoGiaRecuperato: number;
  cumulatoPrecedente: number;
  sal: SalGuardado[];
  clientId: string | null;
  estimateId: string | null;
}

const alCentimo = (x: number) => Math.round(x * 100) / 100;

export async function estadoSalDellaObra(admin: Admin, businessId: string, projectId: string): Promise<EstadoSal | null> {
  const { data: obra } = await admin
    .from("projects")
    .select("id, client_id, estimate_id, estimates!projects_estimate_id_fkey(id, margin_percent, waste_percent)")
    .eq("business_id", businessId)
    .eq("id", projectId)
    .maybeSingle();
  if (!obra) return null;
  const presupuesto = (obra as unknown as { estimates?: { id: string; margin_percent: number | null; waste_percent: number | null } | null }).estimates ?? null;

  const [lineas, extras, sal, facturas] = await Promise.all([
    presupuesto
      ? admin.from("estimate_lines").select("id, zone, item_name, quantity, total").eq("business_id", businessId).eq("estimate_id", presupuesto.id).order("zone").order("item_name")
      : Promise.resolve({ data: [] as { id: string; zone: string | null; item_name: string; quantity: number; total: number }[] }),
    admin.from("change_orders").select("id, title, amount").eq("business_id", businessId).eq("project_id", projectId).eq("status", "aprobado").order("created_at"),
    admin
      .from("sal")
      .select("id, numero, data, avanzamento, importo_cumulato, importo, recupero_acconto, note, invoice_id")
      .eq("business_id", businessId)
      .eq("project_id", projectId)
      .order("numero"),
    admin.from("invoices").select("id, number, type, status, subtotal").eq("business_id", businessId).eq("project_id", projectId),
  ]);

  const righe = righeDelContratto(
    (lineas.data ?? []) as { id: string; zone: string | null; item_name: string; quantity: number; total: number }[],
    Number(presupuesto?.waste_percent ?? 0),
    Number(presupuesto?.margin_percent ?? 0),
    (extras.data ?? []) as { id: string; title: string; amount: number }[]
  );
  const guardados = (sal.data ?? []) as {
    id: string; numero: number; data: string; avanzamento: Record<string, number>; importo_cumulato: number;
    importo: number; recupero_acconto: number; note: string | null; invoice_id: string | null;
  }[];
  const ultimo = guardados[guardados.length - 1];
  const avanzamentoPrecedente = ultimo?.avanzamento ?? {};

  const porId = new Map((facturas.data ?? []).map((f) => [f.id, f]));
  // El anticipo es lo que se facturó como depósito y no se anuló. Sin
  // impuestos, porque lo que se recupera es trabajo, no IVA.
  const acconti = alCentimo(
    (facturas.data ?? []).filter((f) => f.type === "deposito" && f.status !== "cancelado").reduce((s, f) => s + Number(f.subtotal ?? 0), 0)
  );

  return {
    righe: righe.map((r) => ({ ...r, percentualePrecedente: Number(avanzamentoPrecedente[r.chiave] ?? 0) })),
    contratto: alCentimo(righe.reduce((s, r) => s + r.importo, 0)),
    acconti,
    accontoGiaRecuperato: alCentimo(guardados.reduce((s, g) => s + Number(g.recupero_acconto ?? 0), 0)),
    cumulatoPrecedente: Number(ultimo?.importo_cumulato ?? 0),
    sal: guardados.map((g) => {
      const f = g.invoice_id ? porId.get(g.invoice_id) : undefined;
      return {
        id: g.id,
        numero: g.numero,
        data: g.data,
        importoCumulato: Number(g.importo_cumulato),
        importo: Number(g.importo),
        recuperoAcconto: Number(g.recupero_acconto ?? 0),
        note: g.note,
        invoiceId: f ? g.invoice_id : null,
        invoiceNumber: f?.number ?? null,
        invoiceStatus: f?.status ?? null,
      };
    }),
    clientId: obra.client_id ?? null,
    estimateId: obra.estimate_id ?? null,
  };
}

export function calcoloDaEstado(estado: EstadoSal, avanzamento: Record<string, number>): CalcoloSal {
  return calcolaSal({
    righe: estado.righe,
    avanzamento,
    avanzamentoPrecedente: Object.fromEntries(estado.righe.map((r) => [r.chiave, r.percentualePrecedente])),
    cumulatoPrecedente: estado.cumulatoPrecedente,
    acconti: estado.acconti,
    accontoGiaRecuperato: estado.accontoGiaRecuperato,
  });
}

export type ResultadoNuevoSal =
  | { ok: true; id: string; numero: number; calcolo: CalcoloSal }
  | { ok: false; code: "sal_obra_no_encontrada" | "sal_sin_contrato" | "sal_sin_avance" | "fecha_no_valida" }
  | { ok: false; code: "sal_fuera_de_rango" | "sal_retrocede"; partidas: string[] };

export async function certificarSal(
  admin: Admin,
  businessId: string,
  projectId: string,
  entrada: { avanzamento: unknown; data?: unknown; note?: unknown }
): Promise<ResultadoNuevoSal> {
  const estado = await estadoSalDellaObra(admin, businessId, projectId);
  if (!estado) return { ok: false, code: "sal_obra_no_encontrada" };
  if (estado.righe.length === 0) return { ok: false, code: "sal_sin_contrato" };

  const avanzamento: Record<string, number> = {};
  if (entrada.avanzamento && typeof entrada.avanzamento === "object") {
    for (const [k, v] of Object.entries(entrada.avanzamento as Record<string, unknown>)) avanzamento[k] = Number(v);
  }
  const data = typeof entrada.data === "string" && entrada.data ? entrada.data : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) return { ok: false, code: "fecha_no_valida" };

  const calcolo = calcoloDaEstado(estado, avanzamento);
  const nombre = (k: string) => estado.righe.find((r) => r.chiave === k)?.descrizione ?? k;
  if (calcolo.errori.fuoriRango.length) return { ok: false, code: "sal_fuera_de_rango", partidas: calcolo.errori.fuoriRango.map(nombre) };
  if (calcolo.errori.retrocede.length) return { ok: false, code: "sal_retrocede", partidas: calcolo.errori.retrocede.map(nombre) };
  if (calcolo.importo <= 0) return { ok: false, code: "sal_sin_avance" };

  const numero = (estado.sal[estado.sal.length - 1]?.numero ?? 0) + 1;
  const { data: fila, error } = await admin
    .from("sal")
    .insert({
      business_id: businessId,
      project_id: projectId,
      numero,
      data,
      // Las partidas se guardan con su precio de hoy: si mañana se toca el
      // presupuesto, este SAL tiene que seguir imprimiéndose como se firmó.
      righe: calcolo.righe,
      avanzamento: Object.fromEntries(calcolo.righe.map((r) => [r.chiave, r.percentuale])),
      importo_cumulato: calcolo.cumulato,
      importo: calcolo.importo,
      recupero_acconto: calcolo.recuperoAcconto,
      note: typeof entrada.note === "string" && entrada.note.trim() ? entrada.note.trim().slice(0, 500) : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { ok: true, id: fila.id, numero, calcolo };
}

/** Un SAL guardado, con sus partidas tal como se certificaron. */
export async function salGuardado(admin: Admin, businessId: string, salId: string) {
  const { data } = await admin
    .from("sal")
    .select("id, project_id, numero, data, righe, importo_cumulato, importo, recupero_acconto, note, invoice_id, projects(name, client_id, estimate_id, clients(name))")
    .eq("business_id", businessId)
    .eq("id", salId)
    .maybeSingle();
  if (!data) return null;
  const obra = data.projects as unknown as { name: string; client_id: string | null; estimate_id: string | null; clients: { name: string } | null } | null;
  const importo = Number(data.importo);
  const recuperoAcconto = Number(data.recupero_acconto ?? 0);
  const righe = (data.righe ?? []) as RigaSal[];
  return {
    id: data.id,
    projectId: data.project_id,
    numero: data.numero,
    data: data.data,
    righe,
    importoCumulato: Number(data.importo_cumulato),
    precedente: alCentimo(Number(data.importo_cumulato) - importo),
    importo,
    recuperoAcconto,
    daFatturare: alCentimo(importo - recuperoAcconto),
    finale: righe.length > 0 && righe.every((r) => r.percentuale >= 100),
    note: data.note,
    invoiceId: data.invoice_id,
    projectName: obra?.name ?? "",
    clientId: obra?.client_id ?? null,
    clientName: obra?.clients?.name ?? null,
    estimateId: obra?.estimate_id ?? null,
  };
}

/**
 * El IVA de la factura de un SAL, si nadie dice otro: el de la última factura
 * de la misma obra. Una reforma facturada al 10 % no pasa al 22 % en el
 * segundo SAL porque el negocio tenga el 22 % por defecto.
 */
export async function ivaDeLaObra(admin: Admin, businessId: string, projectId: string): Promise<OpcionIva | undefined> {
  const { data } = await admin
    .from("invoices")
    .select("tax_breakdown")
    .eq("business_id", businessId)
    .eq("project_id", projectId)
    .neq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(1);
  const d = data?.[0]?.tax_breakdown;
  if (!esDesgloseIva(d)) return undefined;
  if (d.natura === "N6.3") return "rc";
  const opcion = String(d.ivaAliquota);
  return opcion === "22" || opcion === "10" || opcion === "4" ? opcion : undefined;
}
