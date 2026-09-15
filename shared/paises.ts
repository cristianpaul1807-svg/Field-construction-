/**
 * Qué se le pide a un negocio según dónde está.
 *
 * Hasta aquí el producto daba Canadá por hecho en todas partes: los números de
 * TPS y TVQ, la licencia RBQ, la retención del Código Civil de Quebec, la CCQ y
 * las tasas por provincia estaban escritos como si no hubiera otro sitio. Eso
 * funciona mientras el único usuario esté en Quebec y se rompe en silencio el
 * día que no: a alguien de fuera se le pediría un número de TVQ que no tiene, y
 * le saldría impreso en cada factura un impuesto que no le corresponde.
 *
 * Esto es el único sitio donde vive esa diferencia. Añadir un país es añadir una
 * entrada aquí, no buscar los sesenta y dos sitios donde pone `province`.
 *
 * **Lo que no está no se ofrece.** Sólo se listan los países cuyas reglas
 * sabemos hacer enteras. Dejar elegir un país para el que no calculamos el
 * impuesto sería darle a alguien facturas mal hechas con aspecto de correctas,
 * que es peor que decirle que todavía no llegamos.
 */

/** Lo que un país declara que hace falta. */
export interface Pais {
  /** ISO-3166 alfa-2. */
  codigo: string;
  /** Cómo se llama la región allí. La clave, no el texto: esto no traduce. */
  etiquetaDeRegion: string;
  /** Las regiones, con el código con el que se guardan. */
  regiones: { codigo: string; nombre: string }[];
  /**
   * Los identificadores fiscales que se imprimen en cada documento. Vacío es
   * una respuesta válida: hay sitios donde la factura no lleva ninguno.
   */
  identificadoresFiscales: { campo: "gst" | "qst"; etiqueta: string; ejemplo: string }[];
  /** Si allí hay una licencia de contratista que va impresa. */
  licencia: { etiqueta: string; ejemplo: string } | null;
  /** Si se retiene una parte de cada pago parcial hasta terminar la obra. */
  retencion: boolean;
  /** Si hay un organismo del sector al que declarar las horas. */
  organismoDeConstruccion: "ccq" | null;
}

/** Las diez provincias y los tres territorios, con el nombre con el que se conocen. */
const PROVINCIAS_DE_CANADA = [
  { codigo: "QC", nombre: "Québec" },
  { codigo: "ON", nombre: "Ontario" },
  { codigo: "BC", nombre: "British Columbia" },
  { codigo: "AB", nombre: "Alberta" },
  { codigo: "MB", nombre: "Manitoba" },
  { codigo: "SK", nombre: "Saskatchewan" },
  { codigo: "NS", nombre: "Nova Scotia" },
  { codigo: "NB", nombre: "New Brunswick" },
  { codigo: "NL", nombre: "Newfoundland and Labrador" },
  { codigo: "PE", nombre: "Prince Edward Island" },
  { codigo: "NT", nombre: "Northwest Territories" },
  { codigo: "NU", nombre: "Nunavut" },
  { codigo: "YT", nombre: "Yukon" },
];

export const PAISES: Pais[] = [
  {
    codigo: "CA",
    etiquetaDeRegion: "countries.region.province",
    regiones: PROVINCIAS_DE_CANADA,
    identificadoresFiscales: [
      { campo: "gst", etiqueta: "settings.gstNumber", ejemplo: "123456789 RT0001" },
      { campo: "qst", etiqueta: "settings.qstNumber", ejemplo: "1234567890 TQ0001" },
    ],
    licencia: { etiqueta: "settings.licenseNumber", ejemplo: "RBQ 5842-1234-01" },
    // Código Civil de Quebec: el 10 % de cada pago parcial se retiene hasta que
    // la obra está entregada.
    retencion: true,
    organismoDeConstruccion: "ccq",
  },
];

export const PAIS_POR_DEFECTO = "CA";

export function paisDe(codigo: string | null | undefined): Pais {
  return PAISES.find((p) => p.codigo === codigo) ?? PAISES[0];
}

export function esPaisConocido(codigo: unknown): codigo is string {
  return typeof codigo === "string" && PAISES.some((p) => p.codigo === codigo);
}

/**
 * Si esa región existe en ese país.
 *
 * Se comprueba junto y no por separado: `QC` es una provincia de Canadá y no
 * significa nada en ningún otro sitio, y guardar una región que su país no
 * reconoce deja un negocio sin tasa de impuesto y sin forma de saber por qué.
 */
export function esRegionDe(pais: string, region: unknown): boolean {
  return typeof region === "string" && paisDe(pais).regiones.some((r) => r.codigo === region);
}

/**
 * Si a este negocio le toca lo de la CCQ: Quebec, y sólo Quebec.
 *
 * Se exige que el país sea **conocido**, no que `paisDe` devuelva algo.
 * `paisDe` cae en Canadá cuando no reconoce el código, que es lo correcto para
 * leer un valor guardado y lo contrario de lo correcto para decidir esto: un
 * negocio con el país todavía sin cargar, o con uno que no sabemos hacer, se
 * habría encontrado con que le pedimos su número de la CCQ.
 */
export function aplicaLaCcq(pais: string | null | undefined, region: string | null | undefined): boolean {
  return esPaisConocido(pais) && paisDe(pais).organismoDeConstruccion === "ccq" && region === "QC";
}
