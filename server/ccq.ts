/**
 * Lo que la CCQ necesita saber de cada hora trabajada.
 *
 * En Quebec, un empleador de construcción sujeto a la loi R-20 tiene que mandar
 * cada mes a la Commission de la construction du Québec quién trabajó, en qué
 * oficio, con qué estatuto, en qué sector y en qué región, cuántas horas y
 * cuánto cobró. Vence el 15 del mes siguiente, hay que mandarlo **aunque no se
 * haya trabajado**, y la penalización llega al 20 %.
 *
 * Aquí viven sólo las listas y la validación. El informe se arma en otro sitio:
 * esto es el vocabulario, y el vocabulario cambia con los convenios.
 *
 * **Las listas son abiertas a propósito.** Se guarda lo que el contratista
 * escriba, no un código de una tabla nuestra. Los oficios y las regiones de la
 * CCQ cambian, y una lista cerrada que va por detrás impide declarar a alguien
 * en vez de ayudar — que es la peor forma de fallar en algo con multa.
 */

/** Los cuatro sectores del convenio. Estos sí son estables: están en la ley. */
export const SECTORES_CCQ = ["residentiel", "institutionnel_commercial", "industriel", "genie_civil_voirie"] as const;
export type SectorCcq = (typeof SECTORES_CCQ)[number];

/**
 * Los estatutos. Un apprenti cobra un porcentaje del compagnon según su
 * periodo, así que el número forma parte del estatuto y no es un adorno.
 */
export const ESTATUTOS_CCQ = [
  "compagnon",
  "apprenti_1",
  "apprenti_2",
  "apprenti_3",
  "apprenti_4",
  "apprenti_5",
  "occupation",
] as const;
export type EstatutoCcq = (typeof ESTATUTOS_CCQ)[number];

/** Lo que se guarda de un acuerdo para poder declararlo. */
export interface DatosCcq {
  ccq_trade: string | null;
  ccq_status: string | null;
  ccq_sector: string | null;
  ccq_region: string | null;
}

const limpiar = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const texto = v.trim();
  return texto ? texto.slice(0, 120) : null;
};

const deLaLista = <T extends string>(v: unknown, lista: readonly T[]): T | null => {
  const texto = limpiar(v);
  return texto && (lista as readonly string[]).includes(texto) ? (texto as T) : null;
};

/**
 * Los cuatro campos, saneados.
 *
 * El sector y el estatuto sí se validan contra su lista: son cerrados en la ley
 * y un valor inventado ahí rompería el informe entero. El oficio y la región se
 * guardan tal cual.
 */
export function camposCcq(body: any): DatosCcq {
  return {
    ccq_trade: limpiar(body?.ccqTrade),
    ccq_status: deLaLista(body?.ccqStatus, ESTATUTOS_CCQ),
    ccq_sector: deLaLista(body?.ccqSector, SECTORES_CCQ),
    ccq_region: limpiar(body?.ccqRegion),
  };
}

/**
 * Si a este acuerdo le falta algo para poder declararlo.
 *
 * Se devuelve la lista de lo que falta, no un sí o un no: «incompleto» no le
 * dice a nadie qué escribir. Un acuerdo de subcontrato con un autónomo también
 * declara horas, así que no se le perdona nada por ser subcontrato.
 */
export function loQueFaltaParaLaCcq(acuerdo: Partial<DatosCcq>): (keyof DatosCcq)[] {
  const campos: (keyof DatosCcq)[] = ["ccq_trade", "ccq_status", "ccq_sector", "ccq_region"];
  return campos.filter((c) => !acuerdo[c]);
}
