/**
 * Qué deja hacer cada plan.
 *
 * Aparte de `permisos.ts` a propósito, porque son dos ejes distintos y
 * mezclarlos sale caro. Los permisos dicen **quién** dentro de una empresa ve
 * qué; el plan dice **qué puede hacer la empresa entera**. Un jefe de obra sin
 * acceso a los números y un contratista que no ha contratado las nóminas ven
 * la misma pantalla vacía por razones que no tienen nada que ver, y el día que
 * haya que cambiar una no se puede estar tocando la otra.
 *
 * La regla al repartir: se corta por **capacidades enteras**, nunca por
 * funciones sueltas. Quitar media pantalla deja un producto que parece roto;
 * quitar «las nóminas» se entiende sin explicación. Y hay dos cosas que no se
 * venden nunca —están en todos los planes y no aparecen aquí—: el doble factor
 * y los trabajadores de campo. Cobrar por el primero es cobrar por no tener un
 * agujero; cobrar por los segundos es cobrarle al contratista por darnos los
 * datos con los que funciona todo lo demás.
 */

/**
 * Los planes.
 *
 * `pilot` es el que tienen los negocios que ya existían —la columna
 * `businesses.subscription_plan` nace con ese valor— y se trata como
 * `fondateur`: nadie se queda fuera de su propio sistema por estrenar esto.
 */
export const PLANES = ["prueba", "chantier", "entreprise", "fondateur", "pilot"] as const;
export type Plan = (typeof PLANES)[number];

/**
 * Lo que se puede contratar.
 *
 * Cada una es un trozo de producto que se entiende solo al nombrarlo. Si hace
 * falta una frase para explicar por qué una función está en una capacidad y no
 * en otra, la división está mal hecha.
 */
export const CAPACIDADES = [
  /** Obras, órdenes de trabajo, agenda, fichaje, fotos. La base. */
  "campo",
  /** Clientes, portal, presupuestos, facturas, cobros. La base. */
  "facturacion",
  /** Nóminas, T4, acuerdos y papeles de cada persona. */
  "nomina",
  /** El informe mensual de la CCQ. */
  "cumplimiento",
  /** Control de costes y beneficio por obra. */
  "margen",
  /** La contabilidad conectada: QuickBooks y las exportaciones. */
  "contabilidad",
  /** Reportes: cuentas por cobrar, rentabilidad, dinero en Stripe. */
  "reportes",
  /** Personas de oficina con acceso limitado a unas áreas. */
  "equipo",
] as const;
export type Capacidad = (typeof CAPACIDADES)[number];

const BASE: Capacidad[] = ["campo", "facturacion"];
const TODO: Capacidad[] = [...CAPACIDADES];

export interface Definicion {
  capacidades: Capacidad[];
  /**
   * Cuántas personas pueden entrar al panel. `null` es sin límite.
   *
   * No cuenta a los trabajadores de campo: ésos entran por su código en
   * `/campo`, no pisan el panel, y son ilimitados siempre.
   */
  personasDeOficina: number | null;
}

export const PLAN: Record<Plan, Definicion> = {
  // Los 30 días se prueban enteros. Una prueba recortada no prueba nada, y el
  // contratista decide justo en lo que le habríamos escondido: el cierre de
  // mes, la nómina, el informe de la CCQ.
  prueba: { capacidades: TODO, personasDeOficina: null },

  // Para quien lo lleva él, con dos o tres personas y su contable aparte.
  chantier: { capacidades: BASE, personasDeOficina: 2 },

  // Para quien ya tiene gente en nómina. Es el plan principal.
  entreprise: { capacidades: TODO, personasDeOficina: null },

  // Se asigna, no se compra: no hay suscripción de Stripe detrás. Néstor y los
  // que vengan detrás de él.
  fondateur: { capacidades: TODO, personasDeOficina: null },

  // Lo que había antes de que existieran los planes.
  pilot: { capacidades: TODO, personasDeOficina: null },
};

/** El plan de un negocio, con lo que hay en la base. Lo que no se reconoce se trata como `pilot`. */
export function planDe(valor: string | null | undefined): Plan {
  return PLANES.includes(valor as Plan) ? (valor as Plan) : "pilot";
}

export function tiene(plan: Plan, capacidad: Capacidad): boolean {
  return PLAN[plan].capacidades.includes(capacidad);
}

/**
 * Qué capacidad necesita cada familia de rutas del panel.
 *
 * Sólo están las que se cobran. Una familia que no aparezca aquí es de las que
 * tiene todo el mundo — al revés que en `permisos.ts`, donde no estar en el
 * mapa niega. La diferencia es deliberada: allí el riesgo es enseñarle a
 * alguien lo que no debe ver, y aquí es apagarle a un contratista una pantalla
 * que sí pagó. En caso de duda, uno esconde y el otro deja pasar.
 */
export const CAPACIDAD_DE: Record<string, Capacidad> = {
  payroll: "nomina",
  // `agreements` y `worker-documents` **no** entran aquí, aunque el acuerdo
  // diga lo que cobra alguien. Viven dentro de la ficha del técnico, que es de
  // campo y la tienen todos: cobrarlos dejaba un error a media pantalla que sí
  // es suya. Y aunque se pudieran separar, no habría que hacerlo — un
  // contratista contrata gente aunque no nos compre la nómina, y sus contratos
  // son suyos. Lo que cobra cada uno ya lo tapan los permisos por áreas, que
  // es donde toca.

  ccq: "cumplimiento",

  "cost-tracking": "margen",

  quickbooks: "contabilidad",
  export: "contabilidad",

  reports: "reportes",
};

/** La capacidad que pide una ruta, o `null` si esa familia entra en todos los planes. */
export function capacidadDeLaRuta(ruta: string): Capacidad | null {
  const familia = ruta.replace(/^\/+/, "").split(/[/?]/)[0];
  return CAPACIDAD_DE[familia] ?? null;
}

/** Lo mismo para las pantallas, que no se llaman igual que sus rutas. */
export const CAPACIDAD_DE_PANTALLA: Record<string, Capacidad> = {
  "/payroll": "nomina",
  "/cost-tracking": "margen",
  "/reports": "reportes",
  "/settings/quickbooks": "contabilidad",
};

export function capacidadDeLaPantalla(ruta: string): Capacidad | null {
  let mejor: Capacidad | null = null;
  let largo = -1;
  for (const [camino, capacidad] of Object.entries(CAPACIDAD_DE_PANTALLA)) {
    const encaja = ruta === camino || ruta.startsWith(`${camino}/`);
    if (encaja && camino.length > largo) {
      mejor = capacidad;
      largo = camino.length;
    }
  }
  return mejor;
}

/**
 * Los precios, en un solo sitio.
 *
 * Provisionales hasta que Néstor conteste qué cubren los 200 $/semana que paga
 * hoy un contratista de allá por la nómina y la CCQ. Si resulta que es sólo
 * eso, `entreprise` se queda corto y sube — y subirlo antes del primer cliente
 * es gratis, mientras que subírselo a quien ya entró no se hace nunca.
 */
export const PRECIO: Partial<Record<Plan, { mes: number; ano: number; moneda: "CAD" }>> = {
  chantier: { mes: 99, ano: 990, moneda: "CAD" },
  entreprise: { mes: 249, ano: 2490, moneda: "CAD" },
};

/**
 * Pagar el año sale dos meses gratis.
 *
 * Diez por doce y no un porcentaje: «paga diez meses, usa doce» se explica en
 * una frase y se recuerda. Un 20 % dejaría el Chantier en 950,40 $, un número
 * que nadie retiene y que parece calculado para confundir.
 */
export const MESES_QUE_SE_PAGAN_AL_ANO = 10;

export type Periodo = "mes" | "ano";
export const PERIODOS: readonly Periodo[] = ["mes", "ano"];

/**
 * El nombre por el que el servidor le pide a Stripe cada precio.
 *
 * Por `lookup_key` y no por el identificador del precio. Un `price_1UGd4T…`
 * hay que guardarlo en una variable de entorno, es distinto en la cuenta de
 * pruebas y en la real, y el día que alguien cambie un precio en Stripe —que
 * obliga a crear uno nuevo, porque no se editan— la variable apunta al viejo y
 * se sigue cobrando lo de antes sin que nada falle. La clave de búsqueda se
 * mueve al precio nuevo y no hay nada que actualizar aquí.
 */
export function claveDelPrecio(plan: Plan, periodo: Periodo): string {
  return `${plan}_${periodo}`;
}

/** Los planes que se pueden contratar. Los otros tres no se venden. */
export const PLANES_DE_PAGO = ["chantier", "entreprise"] as const;
export type PlanDePago = (typeof PLANES_DE_PAGO)[number];

export function esPlanDePago(valor: string): valor is PlanDePago {
  return (PLANES_DE_PAGO as readonly string[]).includes(valor);
}

/** Días de prueba. Un mes entero porque lo que convence pasa al cerrar el mes. */
export const DIAS_DE_PRUEBA = 30;
