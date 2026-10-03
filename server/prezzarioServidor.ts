/**
 * Buscar en el prezzario regionale de un negocio. Lo usan el panel y el MCP.
 *
 * Cada palabra tiene que estar en la descripción o en el código: «intonaco
 * calce» encuentra el intonaco a base de calce aunque las dos palabras estén
 * separadas por otras diez, que es como se escriben las voces.
 */

import type { getSupabaseAdmin } from "./supabaseAdmin";

type Cliente = ReturnType<typeof getSupabaseAdmin>;

export interface VoceTrovata {
  id: string;
  fonte: string;
  codice: string;
  descrizione: string;
  unita: string | null;
  prezzo: number | null;
  capitolo: string | null;
}

export async function cercaNelPrezzario(
  db: Cliente,
  businessId: string,
  q: string,
  fonte: string | null,
  limite: number
): Promise<VoceTrovata[]> {
  // Sólo letras, números, punto y guion: lo demás rompería el filtro de
  // PostgREST (comas, paréntesis) o sería un comodín (% y _).
  const palabras = q
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9àáâèéêìíòóôùúç.\-]/g, ""))
    .filter((p) => p.length >= 2)
    .slice(0, 6);
  let consulta = db
    .from("prezzario_voci")
    .select("id, fonte, codice, descrizione, unita, prezzo, capitolo")
    .eq("business_id", businessId);
  if (fonte) consulta = consulta.eq("fonte", fonte);
  for (const p of palabras) consulta = consulta.or(`descrizione.ilike.%${p}%,codice.ilike.%${p}%`);
  const { data, error } = await consulta.order("codice").limit(limite);
  if (error) throw error;
  return (data ?? []).map((v) => ({ ...v, prezzo: v.prezzo === null ? null : Number(v.prezzo) }));
}
