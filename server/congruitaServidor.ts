/**
 * La congruità de una obra con los datos que hay: el valor del contrato y la
 * mano de obra aprobada. La cuenta la hace `shared/congruita.ts`.
 *
 * Se lee con el cliente admin porque el coste por hora de cada persona no se
 * deja leer con una sesión normal; de aquí sólo sale el total de la obra.
 */

import type { getSupabaseAdmin } from "./supabaseAdmin";
import { entryHours } from "./payroll";
import { calcolaCongruita, type Congruita } from "../shared/congruita";
import { paisDe } from "../shared/paises";

type Admin = ReturnType<typeof getSupabaseAdmin>;

export type ResultadoCongruita =
  | { ok: true; congruita: Congruita & {
      lavoroPubblico: boolean;
      /** El valor escrito a mano para la obra, si lo hay; si no, sale del contrato. */
      valoreManuale: number | null;
      valoreContratto: number;
      /** Horas aprobadas de personas sin coste por hora: no suman, y la cifra se queda corta. */
      oreSenzaCosto: number;
    } }
  | { ok: false; code: "congruita_solo_italia" | "congruita_no_encontrada" };

const redondear = (x: number) => Math.round(x * 100) / 100;

export async function congruitaDeLaObra(admin: Admin, businessId: string, projectId: string): Promise<ResultadoCongruita> {
  const { data: negocio } = await admin.from("businesses").select("country").eq("id", businessId).maybeSingle();
  if (!negocio || paisDe(negocio.country).impuestos !== "italia") return { ok: false, code: "congruita_solo_italia" };

  const { data: obra } = await admin
    .from("projects")
    .select("id, congruita_categoria, lavoro_pubblico, valore_opera, estimates!projects_estimate_id_fkey(total)")
    .eq("business_id", businessId)
    .eq("id", projectId)
    .maybeSingle();
  if (!obra) return { ok: false, code: "congruita_no_encontrada" };

  const [cambios, horas, empleados, subcontratas] = await Promise.all([
    admin.from("change_orders").select("amount").eq("business_id", businessId).eq("project_id", projectId).eq("status", "aprobado"),
    admin
      .from("time_entries")
      .select("employee_id, subcontractor_id, check_in_time, check_out_time")
      .eq("business_id", businessId)
      .eq("project_id", projectId)
      .eq("approved", true),
    admin.from("employees").select("id, hourly_rate").eq("business_id", businessId),
    admin.from("subcontractors").select("id, hourly_rate").eq("business_id", businessId),
  ]);

  // El mismo valor de contrato que enseña la obra: presupuesto más extras
  // aprobados. Sin IVA, que es como lo cuenta la Cassa Edile.
  const presupuesto = Number((obra as unknown as { estimates?: { total?: number } | null }).estimates?.total ?? 0);
  const extras = (cambios.data ?? []).reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const valoreContratto = redondear(presupuesto + extras);
  const valoreManuale = obra.valore_opera === null || obra.valore_opera === undefined ? null : Number(obra.valore_opera);

  const tarifa = new Map<string, number>();
  for (const p of [...(empleados.data ?? []), ...(subcontratas.data ?? [])]) {
    if (p.hourly_rate !== null && Number(p.hourly_rate) > 0) tarifa.set(p.id, Number(p.hourly_rate));
  }
  let manodopera = 0;
  let oreSenzaCosto = 0;
  for (const h of horas.data ?? []) {
    const id = h.employee_id ?? h.subcontractor_id;
    const horasDeEsta = entryHours(h.check_in_time, h.check_out_time);
    if (!id || horasDeEsta <= 0) continue;
    const coste = tarifa.get(id);
    if (coste === undefined) oreSenzaCosto += horasDeEsta;
    else manodopera += horasDeEsta * coste;
  }

  const congruita = calcolaCongruita({
    categoria: obra.congruita_categoria ?? null,
    valoreOpera: valoreManuale ?? valoreContratto,
    lavoroPubblico: Boolean(obra.lavoro_pubblico),
    manodopera,
  });
  return {
    ok: true,
    congruita: {
      ...congruita,
      lavoroPubblico: Boolean(obra.lavoro_pubblico),
      valoreManuale,
      valoreContratto,
      oreSenzaCosto: redondear(oreSenzaCosto),
    },
  };
}
