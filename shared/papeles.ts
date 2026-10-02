/**
 * Los papeles de una persona: qué tipos hay en cada país, y cuáles caducan.
 *
 * El dato guardado es el slug (`workerDocs.kinds.<tipo>` al enseñarlo). La
 * lista que se ofrece depende del país, porque en Italia nadie sube un T4 y
 * en Quebec nadie tiene un DURC; pero los slugs son de una sola lista, para
 * que el servidor acepte cualquiera y un negocio que cambie de país no
 * pierda sus papeles por el camino.
 *
 * Caducar es lo que convierte un archivo en un aviso. Un DURC vale 120 días,
 * un curso de seguridad unos años, una revisión médica uno: el día que vence
 * esa persona —o esa empresa subcontratada— no puede entrar en la obra, y la
 * multa no espera a que alguien se acuerde.
 */
import type { GrupoDePais } from "./paises";

export const TIPOS_DE_PAPEL = [
  "contrato",
  "t4",
  "rl1",
  "talon",
  "busta_paga",
  "unilav",
  "durc",
  "patente_crediti",
  "formazione_sicurezza",
  "visita_medica",
  "tessera",
  "otro",
] as const;
export type TipoDePapel = (typeof TIPOS_DE_PAPEL)[number];

export function esTipoDePapel(v: unknown): v is TipoDePapel {
  return typeof v === "string" && (TIPOS_DE_PAPEL as readonly string[]).includes(v);
}

/** Los que se ofrecen al subir, según el país. El primero es el que se propone. */
export function tiposDePapelPara(grupo: GrupoDePais): TipoDePapel[] {
  if (grupo === "CA") return ["t4", "rl1", "talon", "contrato", "otro"];
  if (grupo === "IT") return ["durc", "formazione_sicurezza", "visita_medica", "busta_paga", "unilav", "patente_crediti", "tessera", "contrato", "otro"];
  return ["contrato", "otro"];
}

/** Los que van por año fiscal y no por fecha de caducidad. */
export const PAPELES_POR_ANIO: TipoDePapel[] = ["t4", "rl1"];

/** Los que caducan: se pide la fecha al subirlos. */
export const PAPELES_QUE_CADUCAN: TipoDePapel[] = ["durc", "patente_crediti", "formazione_sicurezza", "visita_medica", "tessera"];

/** Días que faltan hasta la fecha (negativo: ya pasó). Por fecha, sin horas. */
export function diasHasta(fecha: string, hoy: string): number {
  return Math.round((Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);
}

/** A partir de cuántos días se avisa. Un DURC se pide con un mes de margen. */
export const AVISAR_CON_DIAS = 30;
