/**
 * La congruità della manodopera de una obra en Italia (DM 143/2021).
 *
 * Antes del saldo final, la Cassa Edile comprueba que la mano de obra
 * declarada en la obra llega a un mínimo: un porcentaje del valor de la obra
 * que depende del tipo de trabajo. Si no llega, no da el DURC de congruità, y
 * sin él el cliente no puede pagar el saldo. La impresa se entera al final, con
 * la obra terminada y quince días para pagar la diferencia.
 *
 * Aquí se hace la misma cuenta mientras la obra está viva, con las horas
 * aprobadas, para que el aviso llegue cuando todavía se puede hacer algo. Es
 * una estimación: la cifra oficial es la que la impresa y sus subcontratas
 * declaran a la Cassa Edile, que puede incluir costes que aquí no constan.
 *
 * Los índices son los del Accordo collettivo del 10 settembre 2020 (categorías
 * OG, Tabella del DM 143/2021) y los del Accordo del 24 giugno 2022
 * (categorías OS y la bitumatura dentro de OG3, para obras denunciadas desde
 * el 1 de agosto de 2022). Se comprobaron sobre las diapositivas de la CNCE.
 */

export const INDICI_CONGRUITA = {
  og1_civile: 0.1428,
  og1_industriale: 0.0536,
  ristrutturazione_civile: 0.22,
  ristrutturazione_industriale: 0.0669,
  og2: 0.3,
  og3: 0.1377,
  og3_bitumatura: 0.06,
  og4: 0.1082,
  og5: 0.1607,
  og6_acquedotti: 0.1463,
  og6_gasdotti: 0.1366,
  og6_oleodotti: 0.1366,
  og6_irrigazione: 0.1248,
  og7: 0.1216,
  og8: 0.1331,
  og9: 0.1423,
  og10: 0.0536,
  og12_og13: 0.1647,
  os1: 0.1,
  os2a: 0.35,
  os6: 0.14,
  os7: 0.18,
  os8: 0.18,
  os11: 0.125,
  os12a: 0.1,
  os12b: 0.13,
  os13: 0.06,
  os21: 0.15,
  os23: 0.1,
  os24: 0.2,
  os25: 0.3,
  os26: 0.07,
  os35: 0.15,
} as const;

export type CategoriaCongruita = keyof typeof INDICI_CONGRUITA;
export const CATEGORIE_CONGRUITA = Object.keys(INDICI_CONGRUITA) as CategoriaCongruita[];

export function esCategoriaCongruita(v: unknown): v is CategoriaCongruita {
  return typeof v === "string" && v in INDICI_CONGRUITA;
}

/** Desde este valor una obra privada tiene que demostrar la congruità. Las públicas, siempre. */
export const SOGLIA_PRIVATI = 70_000;

/**
 * Lo que la Cassa Edile perdona: si la mano de obra se queda a un 5 % o menos
 * del mínimo, certifica igual con una declaración del director de obra.
 */
export const TOLLERANZA = 0.05;

export type EstadoCongruita =
  /** Sin categoría no hay índice con que comparar. */
  | "sin_categoria"
  /** Obra privada por debajo de 70.000 €: no se pide. */
  | "no_aplica"
  /** Sin valor de la obra no hay mínimo que calcular. */
  | "sin_valor"
  | "congrua"
  /** Por debajo, pero dentro del 5 %: certifica con declaración del DL. */
  | "tolleranza"
  | "non_congrua";

export interface Congruita {
  estado: EstadoCongruita;
  categoria: CategoriaCongruita | null;
  indice: number | null;
  valoreOpera: number;
  /** El mínimo de mano de obra que pide el índice, al céntimo. */
  minima: number;
  manodopera: number;
  /** manodopera / valoreOpera, en tanto por uno; null sin valor. */
  incidenza: number | null;
  /** Lo que falta para llegar al mínimo, 0 si ya llega. */
  falta: number;
}

const redondear = (x: number) => Math.round(x * 100) / 100;

export function calcolaCongruita(entrada: {
  categoria: string | null;
  valoreOpera: number;
  lavoroPubblico: boolean;
  manodopera: number;
}): Congruita {
  const categoria = esCategoriaCongruita(entrada.categoria) ? entrada.categoria : null;
  const indice = categoria ? INDICI_CONGRUITA[categoria] : null;
  const valoreOpera = redondear(Math.max(0, entrada.valoreOpera || 0));
  const manodopera = redondear(Math.max(0, entrada.manodopera || 0));
  const minima = indice === null ? 0 : redondear(valoreOpera * indice);
  const base = {
    categoria,
    indice,
    valoreOpera,
    minima,
    manodopera,
    incidenza: valoreOpera > 0 ? manodopera / valoreOpera : null,
    falta: redondear(Math.max(0, minima - manodopera)),
  };

  // El orden importa: una obra privada pequeña no necesita categoría, y
  // pedírsela sería trabajo sin motivo.
  if (!entrada.lavoroPubblico && valoreOpera > 0 && valoreOpera < SOGLIA_PRIVATI) return { ...base, estado: "no_aplica" };
  if (indice === null) return { ...base, estado: "sin_categoria" };
  if (valoreOpera <= 0) return { ...base, estado: "sin_valor" };
  if (manodopera >= minima) return { ...base, estado: "congrua" };
  if (manodopera >= minima * (1 - TOLLERANZA)) return { ...base, estado: "tolleranza" };
  return { ...base, estado: "non_congrua" };
}
