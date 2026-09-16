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

// ---------- El informe mensual ----------

/**
 * La hoja que el contratista copia en la página de la CCQ.
 *
 * No es el archivo que la CCQ importa: ese formato no lo publican, hay que
 * pedírselo como proveedor y lo están cambiando. Esto es el paso anterior y el
 * que de verdad ahorra la tarde — tener delante, ya sumado y clasificado, lo
 * que si no habría que reconstruir a mano de las hojas de fichaje.
 *
 * **Por semana y no por mes.** La CCQ declara por semana de trabajo, de domingo
 * a sábado. Un total mensual por trabajador no se puede teclear en su
 * formulario, así que sería una cifra bonita e inútil.
 */

/** Una línea de la hoja: una persona, una semana. */
export interface LineaCcq {
  trabajador: string;
  /** El domingo de esa semana, en `YYYY-MM-DD`. */
  semana: string;
  horas: number;
  horasExtra: number;
  oficio: string | null;
  estatuto: string | null;
  sector: string | null;
  region: string | null;
  /** Lo que falta para poder declarar esta línea. */
  falta: (keyof DatosCcq)[];
}

/** El domingo de la semana a la que pertenece una fecha. */
export function domingoDeLaSemana(fecha: Date): string {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

/** Las horas de un fichaje, redondeadas al centésimo como las declara la CCQ. */
export function horasDe(entrada: string | null, salida: string | null): number {
  if (!entrada || !salida) return 0;
  const ms = new Date(salida).getTime() - new Date(entrada).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

/** El primer día del mes y el primero del siguiente, que es el rango que se pide. */
export function rangoDelMes(mes: string): { desde: string; hasta: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return null;
  const [anio, m] = mes.split("-").map(Number);
  const desde = new Date(Date.UTC(anio, m - 1, 1));
  const hasta = new Date(Date.UTC(anio, m, 1));
  return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) };
}

/**
 * Agrupar los fichajes en líneas de la hoja.
 *
 * Las horas extra se cuentan aparte porque la CCQ las declara aparte: no es un
 * detalle de nómina, es una casilla distinta de su formulario.
 */
export function armarLineas(
  fichajes: { quien: string; entrada: string | null; salida: string | null; extra: boolean }[],
  datos: Map<string, DatosCcq>
): LineaCcq[] {
  const porClave = new Map<string, LineaCcq>();

  for (const f of fichajes) {
    const horas = horasDe(f.entrada, f.salida);
    if (horas <= 0) continue;
    const semana = domingoDeLaSemana(new Date(f.entrada!));
    const clave = `${f.quien}·${semana}`;

    let linea = porClave.get(clave);
    if (!linea) {
      const d = datos.get(f.quien) ?? { ccq_trade: null, ccq_status: null, ccq_sector: null, ccq_region: null };
      linea = {
        trabajador: f.quien,
        semana,
        horas: 0,
        horasExtra: 0,
        oficio: d.ccq_trade,
        estatuto: d.ccq_status,
        sector: d.ccq_sector,
        region: d.ccq_region,
        falta: loQueFaltaParaLaCcq(d),
      };
      porClave.set(clave, linea);
    }

    if (f.extra) linea.horasExtra = Math.round((linea.horasExtra + horas) * 100) / 100;
    else linea.horas = Math.round((linea.horas + horas) * 100) / 100;
  }

  // Por persona y luego por semana: así se teclea, y así se revisa.
  return Array.from(porClave.values()).sort(
    (a, b) => a.trabajador.localeCompare(b.trabajador) || a.semana.localeCompare(b.semana)
  );
}
