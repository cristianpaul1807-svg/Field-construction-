/**
 * Quién ve qué dentro del panel.
 *
 * Había roles en la base y una pantalla para asignarlos desde el primer día,
 * pero **no los miraba nadie**: ninguna ruta los comprobaba y el menú los
 * ignoraba. Un contratista podía crear un rol «Jefe de obra», asignárselo a
 * alguien, y esa persona seguía viendo la facturación y el beneficio. Un
 * control que aparenta proteger y no protege es peor que no tenerlo, porque
 * nadie vuelve a comprobarlo.
 *
 * Esto es la lista de áreas y el mapa de qué ruta pertenece a cuál. El
 * servidor lo usa para bloquear y el cliente para no enseñar lo que de todas
 * formas va a rebotar.
 */

/**
 * Las cinco áreas.
 *
 * Son pocas a propósito. Un permiso por pantalla parece más fino y acaba en
 * una cuadrícula de cuarenta casillas que nadie configura bien, y donde la
 * pantalla nueva del mes que viene nace sin marcar y se le escapa a alguien.
 */
export const AREAS = ["campo", "clientes", "dinero", "personas", "ajustes"] as const;
export type Area = (typeof AREAS)[number];

/**
 * A qué área pertenece cada familia de rutas.
 *
 * Por prefijo y no por ruta: 186 rutas del panel repartidas a mano es una
 * lista que se queda desfasada en la primera semana. `scripts/check-permisos.py`
 * comprueba que ninguna familia se quede sin área.
 */
export const AREA_DE: Record<string, Area> = {
  // El terreno: dónde se trabaja, quién va y cuándo.
  projects: "campo",
  "work-orders": "campo",
  "schedule-events": "campo",
  "time-entries": "campo",
  "work-log": "campo",
  gps: "campo",
  "time-off": "campo",
  photos: "campo",
  documents: "campo",
  "change-orders": "campo",
  "service-types": "campo",
  // La gente sí, pero sin lo que cobra: eso se recorta más abajo.
  employees: "campo",
  subcontractors: "campo",

  clients: "clientes",
  "client-portal": "clientes",
  conversations: "clientes",
  chat: "clientes",
  "appointment-requests": "clientes",

  // Todo lo que es un número de la empresa. Los materiales y las tarifas
  // entran aquí y no en campo: son el coste, que es de dónde sale el margen.
  estimates: "dinero",
  invoices: "dinero",
  "credit-notes": "dinero",
  expenses: "dinero",
  payroll: "dinero",
  reports: "dinero",
  "cost-tracking": "dinero",
  quickbooks: "dinero",
  stripe: "dinero",
  export: "dinero",
  "payment-plan": "dinero",
  "payment-requests": "dinero",
  materials: "dinero",
  "labor-rates": "dinero",
  "budget-categories": "dinero",
  "assembly-templates": "dinero",
  "estimate-reference-documents": "dinero",
  "canada-tax-rates": "dinero",
  ccq: "dinero",

  // Los papeles de cada persona: su acuerdo, lo que cobra, su T4. Es lo más
  // sensible que hay aquí dentro y no lo abre un jefe de obra.
  agreements: "personas",
  "worker-documents": "personas",

  settings: "ajustes",
  notifications: "ajustes",
  "admin-assistant": "ajustes",
};

/**
 * Familias que no son de ningún área: las usa cualquiera, tenga el papel que
 * tenga.
 *
 * Es una lista corta y tiene que seguir siéndolo, porque cada entrada es una
 * puerta que los permisos no miran. Lo que entra aquí es lo que **no es una
 * parte del negocio**, sino la salida de emergencia.
 *
 * Pedir ayuda es justo eso. Quien se topa con el problema en la obra es quien
 * tiene el papel más limitado —un jefe de obra sólo ve campo—, y un sistema de
 * permisos que le conteste 403 a «no puedo seguir, ayúdame» está trabajando en
 * contra del producto. El ticket no enseña ningún dato: lo escribe él.
 */
export const DE_TODOS: readonly string[] = ["soporte"];

function familiaDe(ruta: string): string {
  return ruta.replace(/^\/+/, "").split(/[/?]/)[0];
}

export function esDeTodos(ruta: string): boolean {
  return DE_TODOS.includes(familiaDe(ruta));
}

/** El área de una ruta del panel, o `null` si esa familia no está en el mapa. */
export function areaDeLaRuta(ruta: string): Area | null {
  return AREA_DE[familiaDe(ruta)] ?? null;
}

/**
 * Los papeles que vienen de fábrica.
 *
 * `null` no está aquí y es el más importante: **quien no tiene rol asignado lo
 * ve todo**. Es lo que pasaba hasta hoy, así que poner esto en marcha no deja
 * a nadie fuera de su propio sistema — sólo empieza a limitar a quien se le
 * asigne un papel a propósito.
 */
export const PAPELES: Record<string, Area[]> = {
  // El encargado de obras, proyectos y personal. Ve el terreno entero y no ve
  // un número de la empresa: ni lo que se factura, ni lo que se gana, ni lo
  // que cobra cada uno.
  jefe_de_obra: ["campo"],
  // Quien atiende a los clientes y programa, sin entrar en la contabilidad.
  oficina: ["campo", "clientes"],
  // El contable de la casa: los números, sin tocar la configuración.
  contabilidad: ["dinero", "clientes"],
};

export function puede(areas: Area[] | null, area: Area): boolean {
  // Sin lista, todo. Ver arriba: es el caso de quien lleva el negocio.
  return areas === null || areas.includes(area);
}

/**
 * Campos que no salen si no se tiene el área que los guarda.
 *
 * El menú se puede esconder, pero la respuesta de la API no: `/employees`
 * devuelve `hourly_rate` en la misma lista que el nombre y el teléfono. Sin
 * esto, un jefe de obra vería el sueldo de todos abriendo la pantalla que sí
 * le toca.
 */
export const CAMPOS_RESERVADOS: { campo: string; area: Area }[] = [
  { campo: "hourly_rate", area: "dinero" },
  { campo: "hourlyRate", area: "dinero" },
  { campo: "payAmount", area: "dinero" },
  { campo: "pay_amount", area: "dinero" },
  // El código con el que entra un trabajador a su app. Quien pueda leerlo
  // puede entrar como él.
  { campo: "access_token", area: "personas" },
  { campo: "accessToken", area: "personas" },
];

/** Quita de una respuesta lo que esta persona no puede ver. */
export function recortar<T>(datos: T, areas: Area[] | null): T {
  if (areas === null) return datos;
  const fuera = CAMPOS_RESERVADOS.filter((c) => !areas.includes(c.area)).map((c) => c.campo);
  if (fuera.length === 0) return datos;

  const limpiar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(limpiar);
    if (v && typeof v === "object") {
      const salida: Record<string, unknown> = {};
      for (const [k, valor] of Object.entries(v as Record<string, unknown>)) {
        if (fuera.includes(k)) continue;
        salida[k] = limpiar(valor);
      }
      return salida;
    }
    return v;
  };
  return limpiar(datos) as T;
}

// ---------- Las pantallas ----------

/**
 * A qué área pertenece cada pantalla del panel.
 *
 * Aparte del mapa de rutas de la API porque no se llaman igual: la pantalla es
 * `/invoicing` y sus rutas son `/invoices`, `/credit-notes` y `/payment-plan`.
 * Mantener uno solo obligaría a que una de las dos mitades mintiera.
 */
export const AREA_DE_PANTALLA: Record<string, Area> = {
  // El panel de inicio enseña facturado, gastado y beneficio. Para quien no
  // puede ver los números de la empresa, no es su pantalla de inicio.
  "/": "dinero",

  "/crm": "clientes",
  "/client-portal": "clientes",
  "/communication": "clientes",

  "/projects": "campo",
  "/contracts": "campo",
  "/photo-gallery": "campo",
  "/technicians": "campo",
  "/subcontractors": "campo",
  "/gps-routing": "campo",
  "/check-in": "campo",
  "/work-orders": "campo",
  "/work-log": "campo",
  "/time-off": "campo",
  "/scheduling": "campo",

  "/budgets": "dinero",
  "/materials": "dinero",
  "/cost-tracking": "dinero",
  "/invoicing": "dinero",
  "/payroll": "dinero",
  "/reports": "dinero",

  "/settings/company": "ajustes",
  "/settings/service-types": "ajustes",
  "/settings/payments": "ajustes",
  "/settings/quickbooks": "ajustes",
  "/settings/margins": "ajustes",
  "/settings/users": "ajustes",
  "/settings/whatsapp": "ajustes",
};

/** El área de una pantalla, mirando el prefijo más largo que encaje. */
export function areaDeLaPantalla(ruta: string): Area | null {
  let mejor: Area | null = null;
  let largo = -1;
  for (const [camino, area] of Object.entries(AREA_DE_PANTALLA)) {
    const encaja = camino === "/" ? ruta === "/" : ruta === camino || ruta.startsWith(`${camino}/`);
    if (encaja && camino.length > largo) {
      mejor = area;
      largo = camino.length;
    }
  }
  return mejor;
}

/**
 * Por dónde empieza esta persona.
 *
 * Un jefe de obra no puede aterrizar en el panel de inicio —enseña el
 * beneficio— así que se le lleva a la primera pantalla que sí es suya. Mandarlo
 * a una pantalla en blanco con un «sin permiso» sería técnicamente correcto y
 * una forma pésima de dar la bienvenida a alguien el primer día.
 */
export function primeraPantalla(areas: Area[] | null): string {
  if (areas === null || areas.includes("dinero")) return "/";
  const orden = ["/work-orders", "/projects", "/scheduling", "/crm", "/settings/company"];
  return orden.find((p) => puede(areas, areaDeLaPantalla(p)!)) ?? "/work-orders";
}
