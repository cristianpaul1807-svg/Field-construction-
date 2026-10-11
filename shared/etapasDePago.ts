/**
 * Las tres etapas con las que nace el plan de pagos, y cómo se enseñan.
 *
 * El plan de casa (`DEFAULT_PLAN` en server/paymentPlans.ts) se guarda con un
 * texto de relleno en castellano, y ese texto se copia a cada proyecto y a
 * la descripción de cada factura que emite («Depósito inicial — 50 %»). Casi
 * nadie lo cambia, así que a un cliente de Quebec le salía en su portal y en
 * su factura en un idioma que no es el suyo.
 *
 * Lo guardado no se toca —es el dato—; se traduce al enseñarlo, igual que
 * hacía ya el PDF del presupuesto con la clave de cada etapa. Una etapa que
 * el negocio haya renombrado no coincide con ninguno de estos textos y sale
 * tal cual.
 */

export type ClaveDeEtapa = "deposito" | "avance" | "final";

export const ETAPAS_DE_CASA: Record<ClaveDeEtapa, string> = {
  deposito: "Depósito inicial",
  avance: "Avance de obra",
  final: "Entrega final",
};

/**
 * El texto con la etapa de casa traducida, si empieza por una: vale para el
 * nombre de la etapa («Depósito inicial») y para la descripción de la
 * factura que se emitió con ella («Depósito inicial — 50%»).
 */
export function traducirEtapa(texto: string, nombres: Record<ClaveDeEtapa, string>): string {
  for (const clave of Object.keys(ETAPAS_DE_CASA) as ClaveDeEtapa[]) {
    const original = ETAPAS_DE_CASA[clave];
    if (texto === original || texto.startsWith(`${original} — `)) return nombres[clave] + texto.slice(original.length);
  }
  return texto;
}
