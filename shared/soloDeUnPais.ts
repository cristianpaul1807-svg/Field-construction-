/**
 * Lo que sólo existe en un país, y la regla para que no se cuele en otro.
 *
 * Un negocio de Quebec no tiene por qué ver un DURC, ni poder guardar una
 * Partita IVA en un cliente o un bonus fiscal en una obra: no le sirve, y si
 * llega a escribirse, aparece después en sus PDF, en su portal o en lo que
 * contesta el MCP. La pantalla ya no lo ofrece; esta regla es la del servidor,
 * que es la que vale aunque alguien llame a la API sin pasar por la pantalla.
 *
 * Debajo hay una tercera capa: triggers en la base de datos
 * (`private.exigir_italia_en_obra`, `exigir_italia_en_cliente`,
 * `exigir_pais_en_papel`, `exigir_italia_en_iva`) con las mismas listas, para
 * quien escriba directamente con su sesión; están en
 * docs/desarrollo/paises.md. `scripts/prueba-paises/aislamiento.mjs` comprueba
 * que estas listas coinciden con lo que ofrece cada pantalla.
 *
 * Poner un valor está prohibido fuera de su país; quitarlo, nunca. Un negocio
 * que cambió de país tiene que poder limpiar lo que le quedó.
 */

import type { GrupoDePais } from "./paises";

/** Los campos del cuerpo de cada PATCH que sólo existen en Italia. */
export const CAMPOS_SOLO_ITALIA = {
  obra: ["bonusFiscale", "congruitaCategoria", "lavoroPubblico", "valoreOpera"],
  cliente: ["partitaIva", "codiceFiscale", "codiceDestinatario", "pec"],
} as const;

/** Los tipos de papel de cada país. `contrato` y `otro` valen en todos. */
export const PAPELES_SOLO_DE = {
  IT: ["durc", "formazione_sicurezza", "visita_medica", "busta_paga", "unilav", "patente_crediti", "tessera"],
  CA: ["t4", "rl1", "talon"],
} as const;

/** Si el valor pone algo. Vacío, nulo o `false` es quitar, y eso siempre vale. */
function pone(valor: unknown): boolean {
  if (valor === undefined || valor === null || valor === false) return false;
  if (typeof valor === "string") return valor.trim() !== "";
  return true;
}

/** Los campos de Italia que este cuerpo intenta poner en un negocio de fuera. */
export function camposDeItaliaFuera(grupo: GrupoDePais, cuerpo: Record<string, unknown>, campos: readonly string[]): string[] {
  if (grupo === "IT") return [];
  return campos.filter((c) => pone(cuerpo[c]));
}

/** Si un tipo de papel es de otro país que el del negocio. */
export function papelDeOtroPais(grupo: GrupoDePais, tipo: string): boolean {
  for (const [pais, tipos] of Object.entries(PAPELES_SOLO_DE)) {
    if ((tipos as readonly string[]).includes(tipo) && pais !== grupo) return true;
  }
  return false;
}
