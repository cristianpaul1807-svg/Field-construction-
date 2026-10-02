import type { getSupabaseAdmin } from "./supabaseAdmin";
import { diasHasta } from "../shared/papeles";
import { fechaEnZona, zonaHorariaDelNegocio } from "../shared/zonaHoraria";

/**
 * Lo que caduca, de todas las personas a la vez: el DURC del subcontratista,
 * el curso de seguridad, la revisión médica. Lo vencido y lo que vence en los
 * próximos días. Ver `shared/papeles.ts`.
 */
export async function papelesQueVencen(admin: ReturnType<typeof getSupabaseAdmin>, businessId: string, dias: number) {
  const { data: negocio } = await admin.from("businesses").select("country, province").eq("id", businessId).maybeSingle();
  const hoy = fechaEnZona(new Date(), zonaHorariaDelNegocio(negocio?.country, negocio?.province));
  const [a, m, d] = hoy.split("-").map(Number);
  const limite = new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("worker_documents")
    .select("id, kind, name, expires_on, employee_id, subcontractor_id, employees(name), subcontractors(name)")
    .eq("business_id", businessId)
    .not("expires_on", "is", null)
    .lte("expires_on", limite)
    .order("expires_on");
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    kind: p.kind,
    name: p.name,
    expiresOn: p.expires_on,
    daysLeft: diasHasta(p.expires_on, hoy),
    personKind: p.employee_id ? ("employee" as const) : ("subcontractor" as const),
    personId: p.employee_id ?? p.subcontractor_id,
    personName: p.employees?.name ?? p.subcontractors?.name ?? null,
  }));
}

