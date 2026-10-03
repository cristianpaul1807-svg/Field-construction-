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
  identificadoresFiscales: { campo: CampoFiscal; etiqueta: string; ejemplo: string }[];
  /** Si allí hay una licencia de contratista que va impresa. */
  licencia: { etiqueta: string; ejemplo: string } | null;
  /** Si se retiene una parte de cada pago parcial hasta terminar la obra. */
  retencion: boolean;
  /** Si hay un organismo del sector al que declarar las horas. */
  organismoDeConstruccion: "ccq" | null;
  /** La moneda en la que factura y cobra un negocio de ese país (ISO 4217). */
  moneda: string;
  /**
   * Cómo se calcula el impuesto. En Canadá depende de la provincia; en
   * Italia, del tipo de obra (IVA al 22, 10 o 4 %) y de a quién se factura
   * (la inversione contabile entre empresas del sector va sin IVA).
   */
  impuestos: "canada" | "italia" | "sin_configurar";
  /**
   * Si la nómina se hace aquí. En Italia la lleva el consulente del lavoro
   * —CCNL edilizia, INPS, INAIL, Cassa Edile—, y una nómina italiana hecha a
   * medias es un riesgo legal para el negocio, no una ayuda.
   */
  nomina: boolean;
  /**
   * Si el cliente puede pagar con tarjeta. Depende de que el negocio tenga
   * cuenta de Stripe, y las que se crean hoy son canadienses: el país de una
   * cuenta de Stripe no se cambia nunca, así que abrirle una a un negocio de
   * otro sitio sería obligarle a repetir el alta el día que llegue la suya.
   */
  cobrosConTarjeta: boolean;
  /**
   * Si se puede conectar QuickBooks. La conexión elige el código de impuesto
   * por provincia canadiense (TPS, TVQ, TVH) y fuera de Canadá no tiene cuál
   * elegir: mandaría cada factura con un impuesto que no es el suyo, o no la
   * mandaría nunca.
   */
  quickbooks: boolean;
  /**
   * Si se carga un prezzario regionale. Es la lista oficial de precios de
   * obra de cada región italiana, la que piden las obras públicas y los
   * bonus fiscales para dar por bueno un precio; fuera de Italia no existe
   * nada que se le parezca, y una lista así en un negocio de Quebec serían
   * precios en euros de otra legislación.
   */
  prezzario: boolean;
  /**
   * Todavía no se ofrece. El país está entero en el código, pero falta algo
   * para que sus facturas sean válidas —en Italia, la factura electrónica—, y
   * ofrecerlo sería darle a alguien documentos con aspecto de buenos que no lo
   * son. Sólo lo ve quien ya lo tiene puesto. Hoy ningún país lo lleva: Italia
   * lo llevó hasta tener su XML FatturaPA.
   */
  enPruebas?: boolean;
}

/** Dónde se guarda cada identificador en la ficha del negocio. */
export type CampoFiscal = "gst" | "qst" | "partita_iva" | "codice_fiscale" | "pec";

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

/**
 * Las 107 provincias italianas con la sigla con la que van en una dirección y
 * en la factura electrónica.
 */
const PROVINCIAS_DE_ITALIA = [
  ["AG", "Agrigento"], ["AL", "Alessandria"], ["AN", "Ancona"], ["AO", "Aosta"], ["AP", "Ascoli Piceno"],
  ["AQ", "L'Aquila"], ["AR", "Arezzo"], ["AT", "Asti"], ["AV", "Avellino"], ["BA", "Bari"],
  ["BG", "Bergamo"], ["BI", "Biella"], ["BL", "Belluno"], ["BN", "Benevento"], ["BO", "Bologna"],
  ["BR", "Brindisi"], ["BS", "Brescia"], ["BT", "Barletta-Andria-Trani"], ["BZ", "Bolzano"], ["CA", "Cagliari"],
  ["CB", "Campobasso"], ["CE", "Caserta"], ["CH", "Chieti"], ["CL", "Caltanissetta"], ["CN", "Cuneo"],
  ["CO", "Como"], ["CR", "Cremona"], ["CS", "Cosenza"], ["CT", "Catania"], ["CZ", "Catanzaro"],
  ["EN", "Enna"], ["FC", "Forlì-Cesena"], ["FE", "Ferrara"], ["FG", "Foggia"], ["FI", "Firenze"],
  ["FM", "Fermo"], ["FR", "Frosinone"], ["GE", "Genova"], ["GO", "Gorizia"], ["GR", "Grosseto"],
  ["IM", "Imperia"], ["IS", "Isernia"], ["KR", "Crotone"], ["LC", "Lecco"], ["LE", "Lecce"],
  ["LI", "Livorno"], ["LO", "Lodi"], ["LT", "Latina"], ["LU", "Lucca"], ["MB", "Monza e Brianza"],
  ["MC", "Macerata"], ["ME", "Messina"], ["MI", "Milano"], ["MN", "Mantova"], ["MO", "Modena"],
  ["MS", "Massa-Carrara"], ["MT", "Matera"], ["NA", "Napoli"], ["NO", "Novara"], ["NU", "Nuoro"],
  ["OR", "Oristano"], ["PA", "Palermo"], ["PC", "Piacenza"], ["PD", "Padova"], ["PE", "Pescara"],
  ["PG", "Perugia"], ["PI", "Pisa"], ["PN", "Pordenone"], ["PO", "Prato"], ["PR", "Parma"],
  ["PT", "Pistoia"], ["PU", "Pesaro e Urbino"], ["PV", "Pavia"], ["PZ", "Potenza"], ["RA", "Ravenna"],
  ["RC", "Reggio Calabria"], ["RE", "Reggio Emilia"], ["RG", "Ragusa"], ["RI", "Rieti"], ["RM", "Roma"],
  ["RN", "Rimini"], ["RO", "Rovigo"], ["SA", "Salerno"], ["SI", "Siena"], ["SO", "Sondrio"],
  ["SP", "La Spezia"], ["SR", "Siracusa"], ["SS", "Sassari"], ["SU", "Sud Sardegna"], ["SV", "Savona"],
  ["TA", "Taranto"], ["TE", "Teramo"], ["TN", "Trento"], ["TO", "Torino"], ["TP", "Trapani"],
  ["TR", "Terni"], ["TS", "Trieste"], ["TV", "Treviso"], ["UD", "Udine"], ["VA", "Varese"],
  ["VB", "Verbano-Cusio-Ossola"], ["VC", "Vercelli"], ["VE", "Venezia"], ["VI", "Vicenza"], ["VR", "Verona"],
  ["VT", "Viterbo"], ["VV", "Vibo Valentia"],
].map(([codigo, nombre]) => ({ codigo, nombre }));

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
    moneda: "CAD",
    impuestos: "canada",
    nomina: true,
    cobrosConTarjeta: true,
    quickbooks: true,
    prezzario: false,
  },
  {
    codigo: "IT",
    // La provincia y no la región: es lo que va en la dirección y lo que pide
    // la factura electrónica, con su sigla de dos letras.
    etiquetaDeRegion: "countries.region.provinciaItalia",
    regiones: PROVINCIAS_DE_ITALIA,
    identificadoresFiscales: [
      { campo: "partita_iva", etiqueta: "settings.partitaIva", ejemplo: "01234567890" },
      { campo: "codice_fiscale", etiqueta: "settings.codiceFiscale", ejemplo: "RSSMRA80A01H501U" },
      { campo: "pec", etiqueta: "settings.pec", ejemplo: "impresa@pec.it" },
    ],
    // No hay una licencia de contratista que vaya impresa en la factura.
    licencia: null,
    // Por contrato sí se retiene a veces (la ritenuta a garanzia), así que
    // se deja poner, pero no nace puesta como en Quebec.
    retencion: true,
    organismoDeConstruccion: null,
    moneda: "EUR",
    impuestos: "italia",
    nomina: false,
    // Llega con las cuentas de Stripe italianas, en euros (fase 3).
    cobrosConTarjeta: false,
    quickbooks: false,
    prezzario: true,
    // Abierta desde octubre de 2026: el XML FatturaPA se genera y se valida
    // contra el esquema oficial. El envío al SDI lo hace todavía el negocio
    // con su programa o su commercialista, y la pantalla de facturas lo dice.
  },
];

/** Los que se pueden elegir: los terminados, y el que ya tenga puesto quien mira. */
export function paisesQueSeOfrecen(actual: string | null | undefined): Pais[] {
  const lista = PAISES.filter((p) => !p.enPruebas || p.codigo === actual);
  // Quien se registró desde un país sin configurar tiene que verlo puesto en
  // su ficha; si no, el desplegable sale vacío y al guardar parece que se le
  // ha cambiado el país.
  if (actual && !PAISES.some((p) => p.codigo === actual) && OTROS_PAISES[actual]) lista.push(paisDe(actual));
  return lista;
}

export const PAIS_POR_DEFECTO = "CA";

/**
 * Los países que todavía no sabemos hacer, con su moneda.
 *
 * Quien se registra desde uno de ellos entra igual: puede llevar sus obras,
 * su gente y su agenda desde el primer día. Lo que no se le da es un impuesto
 * inventado. Sus facturas esperan a que su país esté configurado, y el panel
 * se lo dice con el camino a soporte, en vez de dejarle emitir documentos con
 * el IVA de otro sitio.
 *
 * La moneda sí se sabe, y es la que ve en pantalla: un contratista de Madrid
 * que lee sus presupuestos en dólares canadienses cree que el producto no es
 * para él.
 */
export const OTROS_PAISES: Record<string, string> = {
  ES: "EUR", FR: "EUR", DE: "EUR", PT: "EUR", BE: "EUR", NL: "EUR", AT: "EUR", IE: "EUR",
  LU: "EUR", GR: "EUR", FI: "EUR", SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR",
  MT: "EUR", CY: "EUR", HR: "EUR", BG: "EUR", GB: "GBP", CH: "CHF", RO: "RON", PL: "PLN",
  CZ: "CZK", HU: "HUF", SE: "SEK", DK: "DKK", NO: "NOK", AL: "ALL", MA: "MAD",
  US: "USD", MX: "MXN", AR: "ARS", BO: "BOB", BR: "BRL", CL: "CLP", CO: "COP", CR: "CRC",
  CU: "CUP", DO: "DOP", EC: "USD", SV: "USD", GT: "GTQ", HN: "HNL", NI: "NIO", PA: "USD",
  PY: "PYG", PE: "PEN", PR: "USD", UY: "UYU", VE: "VES", AU: "AUD", NZ: "NZD",
};

/**
 * Donde Stripe deja abrir una cuenta a un negocio (stripe.com/global, mirado
 * en septiembre de 2026). Es lo que separa «todavía no cobramos con tarjeta
 * en tu país» de «Stripe no opera en tu país»: a un contratista de Bogotá
 * decirle lo primero es prometerle algo que no depende de nosotros.
 */
const PAISES_CON_STRIPE = new Set([
  "AU", "AT", "BE", "BR", "BG", "CA", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GI", "GR", "HK",
  "HU", "IE", "IT", "JP", "LV", "LI", "LT", "LU", "MY", "MT", "MX", "NL", "NZ", "NO", "PL", "PT", "RO",
  "SG", "SK", "SI", "ES", "SE", "CH", "TH", "AE", "GB", "US",
  // Puerto Rico abre la cuenta como Estados Unidos.
  "PR",
]);

export function stripeOperaEn(codigo: string | null | undefined): boolean {
  return !!codigo && PAISES_CON_STRIPE.has(codigo);
}

/** Un país que existe pero cuyas reglas todavía no sabemos hacer. */
function paisSinConfigurar(codigo: string): Pais {
  return {
    codigo,
    etiquetaDeRegion: "countries.region.province",
    regiones: [],
    identificadoresFiscales: [],
    licencia: null,
    retencion: false,
    organismoDeConstruccion: null,
    moneda: OTROS_PAISES[codigo],
    impuestos: "sin_configurar",
    nomina: false,
    cobrosConTarjeta: false,
    quickbooks: false,
    prezzario: false,
  };
}

/**
 * Las reglas de un país.
 *
 * Sin país guardado —los negocios de antes de que se preguntara— es Canadá,
 * que es lo que eran. Un país de `OTROS_PAISES` devuelve sus reglas vacías y
 * su moneda, nunca las de Canadá: eso le pondría TPS y TVQ a alguien de Madrid.
 */
export function paisDe(codigo: string | null | undefined): Pais {
  const conocido = PAISES.find((p) => p.codigo === codigo);
  if (conocido) return conocido;
  if (codigo && OTROS_PAISES[codigo]) return paisSinConfigurar(codigo);
  return PAISES[0];
}

/** Si el país es uno de los que se pueden elegir al darse de alta. */
export function esPaisDelRegistro(codigo: unknown): codigo is string {
  return typeof codigo === "string" && (PAISES.some((p) => p.codigo === codigo) || codigo in OTROS_PAISES);
}

/**
 * Si al negocio le falta algo por ser de donde es: un país sin configurar, o
 * uno en pruebas (Italia, mientras no hay factura electrónica). Es lo que
 * decide el aviso del panel.
 */
export function avisoDelPais(codigo: string | null | undefined): "sin_configurar" | "en_pruebas" | null {
  const pais = paisDe(codigo);
  if (pais.impuestos === "sin_configurar") return "sin_configurar";
  if (pais.enPruebas) return "en_pruebas";
  return null;
}

/**
 * El país de quien se está registrando, adivinado sin pedirle permiso.
 *
 * La zona horaria del navegador primero: dice dónde está el aparato y no en
 * qué idioma lo tiene puesto —un contratista italiano en Montreal tiene el
 * móvil en italiano y vive en Quebec—. Después la región del idioma, que es
 * lo único que queda cuando la zona no es de ningún país conocido. Es una
 * propuesta: el formulario la enseña y se cambia con un toque.
 */
export function detectarPais(zonaHoraria: string | undefined, idiomas: readonly string[]): string | null {
  const zona = zonaHoraria ?? "";
  if (/^America\/(Toronto|Montreal|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Whitehorse|Yellowknife|Iqaluit|Glace_Bay|Goose_Bay|Swift_Current|Dawson_Creek|Fort_Nelson|Creston|Nipigon|Thunder_Bay|Rainy_River|Rankin_Inlet|Resolute|Cambridge_Bay|Inuvik|Dawson|Atikokan|Blanc-Sablon)$/.test(zona)) return "CA";
  if (zona === "Europe/Rome") return "IT";
  const porZona: Record<string, string> = {
    "Europe/Madrid": "ES", "Atlantic/Canary": "ES", "Europe/Paris": "FR", "Europe/Berlin": "DE",
    "Europe/Lisbon": "PT", "Europe/Brussels": "BE", "Europe/Amsterdam": "NL", "Europe/Vienna": "AT",
    "Europe/Dublin": "IE", "Europe/London": "GB", "Europe/Zurich": "CH", "Europe/Bucharest": "RO",
    "Europe/Warsaw": "PL", "Europe/Athens": "GR", "America/Mexico_City": "MX", "America/Bogota": "CO",
    "America/Lima": "PE", "America/Santiago": "CL", "America/Argentina/Buenos_Aires": "AR",
    "America/Caracas": "VE", "America/Guayaquil": "EC", "America/Montevideo": "UY",
    "America/Santo_Domingo": "DO", "America/Sao_Paulo": "BR", "America/New_York": "US",
    "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US",
  };
  if (porZona[zona]) return porZona[zona];
  for (const idioma of idiomas) {
    const region = idioma.split("-")[1]?.toUpperCase();
    if (region && (region === "CA" || region === "IT" || region in OTROS_PAISES)) return region;
  }
  return null;
}

/**
 * A qué grupo pertenece un negocio para lo que se le explica.
 *
 * La ayuda no tiene una versión por país del mundo: tiene la de Canadá, la de
 * Italia y una para los demás, que dice lo que todavía no hacemos allí y a
 * quién escribir. Un país sin guardar es Canadá, como en `paisDe`.
 */
export type GrupoDePais = "CA" | "IT" | "otros";
export function grupoDePais(codigo: string | null | undefined): GrupoDePais {
  const pais = paisDe(codigo);
  if (pais.impuestos === "canada") return "CA";
  if (pais.impuestos === "italia") return "IT";
  return "otros";
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
