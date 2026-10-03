/**
 * Lo que el asistente puede hacer, no sólo consultar (MCP Fase B).
 *
 * Siempre en dos pasos, y es lo único que importa de este archivo:
 *
 * 1. Una herramienta `draft_*` comprueba lo que se pide y guarda un borrador
 *    con el **resumen exacto** de lo que va a pasar —cliente, importes,
 *    impuesto, a quién se le avisa—. No toca nada más.
 * 2. Sólo `confirm_action`, con el id de ese borrador, lo ejecuta. El
 *    asistente lo llama cuando la persona ha dicho que sí; si no lo dice, el
 *    borrador caduca a los quince minutos y no ha pasado nada.
 *
 * Lo ejecuta la misma función que usa el panel —la que crea facturas, la que
 * registra un cobro—, registrada aquí desde `server/api.ts`. Así lo que el
 * panel prohíbe (emitir sin impuesto configurado, cobrar una factura anulada)
 * lo prohíbe también la voz, sin una segunda copia de las reglas.
 *
 * Sólo el propietario principal, y sólo si al conectar marcó la casilla de
 * «preparar y emitir con mi confirmación» (permiso `mcp:write`). Quien
 * conectó en solo lectura sigue en solo lectura.
 *
 * Es el único sitio desde el que el MCP escribe. `scripts/check-mcp-readonly.py`
 * sigue prohibiendo escrituras dentro de `createMcpServer`.
 */

import type { getSupabaseAdmin } from "./supabaseAdmin";

type Admin = ReturnType<typeof getSupabaseAdmin>;

export type TipoDeAccion = "factura" | "factura_sal" | "cobro" | "presupuesto" | "sal";

/** Cuánto vive un borrador sin confirmar. */
export const MINUTOS_PARA_CONFIRMAR = 15;

export interface QuienActua {
  businessId: string;
  ownerAuthUserId: string;
  requestId: string;
  /** De dónde llegó la petición, para los enlaces de los correos. */
  baseUrl: string;
}

export type ResultadoDeEjecucion = { ok: true; detalle: Record<string, unknown> } | { ok: false; code: string; mensaje?: string };
type Ejecutor = (admin: Admin, quien: QuienActua, datos: Record<string, unknown>) => Promise<ResultadoDeEjecucion>;

const EJECUTORES: Partial<Record<TipoDeAccion, Ejecutor>> = {};

/** Lo llama `server/api.ts` al arrancar, con las funciones del panel. */
export function registrarEjecutor(tipo: TipoDeAccion, ejecutor: Ejecutor) {
  EJECUTORES[tipo] = ejecutor;
}

export async function prepararAccion(
  admin: Admin,
  quien: QuienActua,
  tipo: TipoDeAccion,
  datos: Record<string, unknown>,
  resumen: Record<string, unknown>
): Promise<{ actionId: string; expiresAt: string }> {
  const expira = new Date(Date.now() + MINUTOS_PARA_CONFIRMAR * 60_000).toISOString();
  const { data, error } = await admin
    .from("mcp_acciones")
    .insert({
      business_id: quien.businessId,
      owner_auth_user_id: quien.ownerAuthUserId,
      request_id: quien.requestId,
      tipo,
      datos,
      resumen,
      expira_en: expira,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { actionId: data.id, expiresAt: expira };
}

export type ResultadoDeConfirmar =
  | { ok: true; tipo: TipoDeAccion; resumen: Record<string, unknown>; detalle: Record<string, unknown> }
  | { ok: false; code: "action_not_found" | "action_already_done" | "action_expired" | "action_cancelled" | "action_failed"; detalle?: unknown };

export async function confirmarAccion(admin: Admin, quien: QuienActua, actionId: string): Promise<ResultadoDeConfirmar> {
  const { data: fila, error } = await admin
    .from("mcp_acciones")
    .select("id, tipo, estado, datos, resumen, expira_en")
    .eq("business_id", quien.businessId)
    .eq("owner_auth_user_id", quien.ownerAuthUserId)
    .eq("id", actionId)
    .maybeSingle();
  if (error) throw error;
  if (!fila) return { ok: false, code: "action_not_found" };
  if (fila.estado === "cancelled") return { ok: false, code: "action_cancelled" };
  if (fila.estado !== "awaiting_confirmation") return { ok: false, code: "action_already_done" };
  if (new Date(fila.expira_en).getTime() <= Date.now()) {
    await admin.from("mcp_acciones").update({ estado: "expired", terminada_en: new Date().toISOString() }).eq("id", fila.id).eq("estado", "awaiting_confirmation");
    return { ok: false, code: "action_expired" };
  }

  // El paso a `running` sólo lo gana una petición: si el asistente confirma
  // dos veces seguidas, la segunda no encuentra la fila en espera y no emite
  // una segunda factura.
  const { data: tomada, error: errorAlTomar } = await admin
    .from("mcp_acciones")
    .update({ estado: "running", confirmada_en: new Date().toISOString() })
    .eq("id", fila.id)
    .eq("business_id", quien.businessId)
    .eq("estado", "awaiting_confirmation")
    .select("id");
  if (errorAlTomar) throw errorAlTomar;
  if (!tomada || tomada.length === 0) return { ok: false, code: "action_already_done" };

  const ejecutor = EJECUTORES[fila.tipo as TipoDeAccion];
  let resultado: ResultadoDeEjecucion;
  try {
    resultado = ejecutor ? await ejecutor(admin, quien, fila.datos as Record<string, unknown>) : { ok: false, code: "action_not_available" };
  } catch (err) {
    const code = (err as { code?: unknown })?.code;
    resultado = { ok: false, code: typeof code === "string" ? code : "action_failed", mensaje: err instanceof Error ? err.message : String(err) };
  }

  await admin
    .from("mcp_acciones")
    .update({ estado: resultado.ok ? "completed" : "failed", resultado, terminada_en: new Date().toISOString() })
    .eq("id", fila.id)
    .eq("business_id", quien.businessId);

  if (!resultado.ok) return { ok: false, code: "action_failed", detalle: resultado };
  return { ok: true, tipo: fila.tipo as TipoDeAccion, resumen: fila.resumen as Record<string, unknown>, detalle: resultado.detalle };
}

export async function cancelarAccion(admin: Admin, quien: QuienActua, actionId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("mcp_acciones")
    .update({ estado: "cancelled", terminada_en: new Date().toISOString() })
    .eq("id", actionId)
    .eq("business_id", quien.businessId)
    .eq("owner_auth_user_id", quien.ownerAuthUserId)
    .eq("estado", "awaiting_confirmation")
    .select("id");
  if (error) throw error;
  return Boolean(data && data.length);
}
