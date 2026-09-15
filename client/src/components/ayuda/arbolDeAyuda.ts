/**
 * El árbol del bot de ayuda.
 *
 * Aquí vive la **forma** —qué secciones hay, qué temas cuelgan de cada una y
 * cuántos párrafos tiene cada respuesta—; las palabras viven en los cuatro
 * archivos de idioma, bajo `help.`. Separarlo así es lo que permite añadir un
 * tema sin tocar traducciones y traducir sin tocar la lógica.
 *
 * No hay modelo detrás y no debe haberlo. Un contratista que no sabe dónde se
 * pone el número de TVQ necesita la respuesta correcta en dos toques, no una
 * redacción distinta cada vez. El árbol siempre contesta lo mismo, funciona
 * sin conexión al modelo y no cuesta nada por pregunta.
 */

export interface TemaDeAyuda {
  id: string;
  /** Cuántos párrafos lleva la respuesta: `p1`, `p2`… en el archivo de idioma. */
  parrafos: number;
  /** Si además cierra con un aviso corto (`nota`). */
  nota?: boolean;
  /** Dónde se hace de verdad. Pone un botón que lleva allí. */
  ruta?: string;
}

export interface SeccionDeAyuda {
  id: string;
  temas: TemaDeAyuda[];
  /**
   * Pantallas del panel a las que pertenece esta sección. Sirve para abrir la
   * ayuda ya colocada donde está la persona: quien pide ayuda desde Facturación
   * pregunta por facturas, no por el idioma del panel.
   */
  rutas?: string[];
}

export const ARBOL_DE_AYUDA: SeccionDeAyuda[] = [
  {
    id: "empezar",
    temas: [
      { id: "datosEmpresa", parrafos: 3, nota: true, ruta: "/settings/company" },
      { id: "accesoTrabajador", parrafos: 3, nota: true, ruta: "/technicians" },
      { id: "accesoCliente", parrafos: 3, nota: true, ruta: "/crm" },
      { id: "idioma", parrafos: 2 },
    ],
  },
  {
    id: "clientes",
    rutas: ["/crm", "/client-portal", "/communication"],
    temas: [
      { id: "nuevoContacto", parrafos: 2, ruta: "/crm" },
      { id: "enlacePublico", parrafos: 3, nota: true, ruta: "/settings/company" },
      { id: "queVeElCliente", parrafos: 3, ruta: "/client-portal" },
      { id: "quePuedeHacerElCliente", parrafos: 3, nota: true, ruta: "/client-portal" },
      { id: "exportar", parrafos: 3, ruta: "/crm" },
    ],
  },
  {
    id: "presupuestos",
    rutas: ["/budgets", "/materials"],
    temas: [
      { id: "crear", parrafos: 3, ruta: "/budgets" },
      { id: "visibilidad", parrafos: 2, nota: true },
      { id: "margenYmerma", parrafos: 2 },
      { id: "enviarYaceptar", parrafos: 3, nota: true },
      // La mayoría de los clientes que ya tiene un contratista llegaron por
      // WhatsApp y van a seguir ahí. Ese camino existe entero en el producto y
      // no se explicaba en ninguna parte, que es como se pierden obras: el
      // presupuesto sale, el cliente dice que sí por fuera, y aquí dentro no
      // pasa nada porque nadie lo marcó.
      { id: "porFuera", parrafos: 4, nota: true, ruta: "/budgets" },
    ],
  },
  {
    id: "trabajo",
    rutas: ["/projects", "/work-orders", "/scheduling", "/check-in", "/work-log", "/technicians", "/gps-routing", "/time-off"],
    temas: [
      { id: "crearOrden", parrafos: 3, ruta: "/work-orders" },
      { id: "numeroDeObra", parrafos: 3, nota: true, ruta: "/work-log" },
      { id: "tiposDeTrabajo", parrafos: 2, ruta: "/settings/service-types" },
      { id: "comoFicha", parrafos: 3, nota: true },
      { id: "queVeElTrabajador", parrafos: 3, nota: true },
      { id: "verHoras", parrafos: 2, ruta: "/work-log" },
      // Lo que se acordó con cada uno dejaba de existir en cuanto se
      // cerraba la conversación en la que se dijo.
      { id: "acuerdo", parrafos: 4, nota: true, ruta: "/technicians" },
      { id: "vacaciones", parrafos: 3, nota: true, ruta: "/time-off" },
      // Lo de la CCQ está repartido entre dos pantallas —el número en los
      // datos de la empresa, el oficio en cada acuerdo— y sin esto nadie
      // encuentra la segunda.
      { id: "ccq", parrafos: 3, nota: true, ruta: "/technicians" },
      // Los papeles que genera la nómina de fuera. Sin esto, el botón de
      // Papeles en la ficha no lo abre nadie porque nadie sabe para qué es.
      { id: "papeles", parrafos: 3, nota: true, ruta: "/technicians" },
    ],
  },
  {
    id: "dinero",
    rutas: ["/invoicing", "/payroll", "/reports", "/cost-tracking", "/settings/payments", "/settings/quickbooks"],
    temas: [
      { id: "crearFactura", parrafos: 3, nota: true, ruta: "/invoicing" },
      { id: "impuestos", parrafos: 3 },
      { id: "numeroFactura", parrafos: 2 },
      { id: "cobrar", parrafos: 3, nota: true, ruta: "/settings/payments" },
      { id: "cobrarPorFuera", parrafos: 3, nota: true, ruta: "/invoicing" },
      { id: "contable", parrafos: 2, ruta: "/reports" },
      // Lo que se manda solo a QuickBooks y qué hacer cuando algo no llega.
      // Sin esto, la primera vez que una factura falla el contratista no sabe
      // ni que existe una pantalla donde mirarlo.
      { id: "quickbooks", parrafos: 4, nota: true, ruta: "/settings/quickbooks" },
      { id: "quickbooksFalla", parrafos: 3, nota: true, ruta: "/settings/quickbooks" },
      // Lo que Stripe se lleva de cada cobro. Es la primera pregunta que hace
      // alguien que mira su banco después de cobrar una factura grande.
      { id: "comisionStripe", parrafos: 3, nota: true, ruta: "/invoicing" },
    ],
  },
  {
    // Sin rutas: no es una pantalla, es entender qué desencadena cada cosa.
    // Va antes de "algo no funciona" porque la mitad de lo que parece una
    // avería es en realidad algo que el sistema hizo solo y nadie esperaba.
    id: "queOcurre",
    temas: [
      { id: "mandoPresupuesto", parrafos: 3, nota: true },
      { id: "aceptaPresupuesto", parrafos: 3 },
      { id: "emitoFactura", parrafos: 3, nota: true },
      { id: "pagaCliente", parrafos: 2 },
      { id: "doyCodigoCliente", parrafos: 3, nota: true },
      { id: "fichaTrabajador", parrafos: 3 },
      { id: "cierroOrden", parrafos: 2 },
      { id: "mandoAcuerdo", parrafos: 3, nota: true },
      { id: "emitoConQuickBooks", parrafos: 3, nota: true },
    ],
  },
  {
    id: "problemas",
    temas: [
      { id: "noVeObras", parrafos: 2, nota: true },
      { id: "horasEnCero", parrafos: 2 },
      { id: "noSeCobra", parrafos: 2 },
      { id: "noLlegaCorreo", parrafos: 2 },
      // Es el tema al que lleva el botón de los avisos de fallo, así que va
      // aquí aunque nadie lo busque por su nombre: quien llega ya está
      // mirando el aviso y lo que necesita es el siguiente paso.
      { id: "avisoDeFallo", parrafos: 3, nota: true },
      // Lo que el sistema se niega a borrar tiene siempre un motivo contable,
      // y sin explicarlo parece que el botón está roto.
      { id: "borrar", parrafos: 3, nota: true },
    ],
  },
];

/**
 * La sección que corresponde a la pantalla abierta.
 *
 * Se compara por prefijo y gana la coincidencia más larga, porque
 * `/settings/payments` pertenece a Dinero mientras que el resto de
 * `/settings/…` no pertenece a ninguna.
 */
export function seccionSegunRuta(ruta: string): SeccionDeAyuda | null {
  let mejor: SeccionDeAyuda | null = null;
  let largo = 0;
  for (const seccion of ARBOL_DE_AYUDA) {
    for (const suya of seccion.rutas ?? []) {
      if ((ruta === suya || ruta.startsWith(`${suya}/`)) && suya.length > largo) {
        mejor = seccion;
        largo = suya.length;
      }
    }
  }
  return mejor;
}
