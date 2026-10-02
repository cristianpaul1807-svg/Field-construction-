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

import type { Area } from "@shared/permisos";
import { grupoDePais, type GrupoDePais } from "@shared/paises";

export interface TemaDeAyuda {
  id: string;
  /** Cuántos párrafos lleva la respuesta: `p1`, `p2`… en el archivo de idioma. */
  parrafos: number;
  /** Si además cierra con un aviso corto (`nota`). */
  nota?: boolean;
  /** Dónde se hace de verdad. Pone un botón que lleva allí. */
  ruta?: string;
  /**
   * Para qué países vale la respuesta. Sin valor, para todos.
   *
   * Una respuesta que habla de la TVQ a un contratista de Bolonia no es media
   * respuesta: es una respuesta falsa, dicha con la seguridad de todas las
   * demás. Cada país ve la suya y no ve las de los otros.
   */
  paises?: GrupoDePais[];
}

export interface SeccionDeAyuda {
  id: string;
  temas: TemaDeAyuda[];
  /** Áreas permitidas para ver esta ayuda; sin valor significa ayuda común. */
  areas?: Area[];
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
      { id: "datosEmpresa", parrafos: 3, nota: true, ruta: "/settings/company", paises: ["CA"] },
      { id: "datosEmpresaItalia", parrafos: 3, nota: true, ruta: "/settings/company", paises: ["IT"] },
      { id: "datosEmpresaOtros", parrafos: 2, nota: true, ruta: "/settings/company", paises: ["otros"] },
      // Qué decide el país y por qué no se cambia desde Configuración. Lo
      // pregunta quien se equivocó al darse de alta, y sin respuesta busca un
      // desplegable que no existe.
      { id: "paisDelNegocio", parrafos: 3, nota: true, ruta: "/settings/company" },
      { id: "accesoTrabajador", parrafos: 3, nota: true, ruta: "/technicians" },
      { id: "accesoCliente", parrafos: 3, nota: true, ruta: "/crm" },
      { id: "idioma", parrafos: 2 },
      { id: "conectarMcp", parrafos: 4, nota: true, ruta: "/settings/mcp-connections" },
      { id: "rolesMcp", parrafos: 4, nota: true, ruta: "/settings/mcp-connections" },
      { id: "estadoMcp", parrafos: 2, nota: true, ruta: "/settings/mcp-connections" },
      // Es la pregunta que hace todo el mundo antes de meter a sus clientes
      // y a su gente, y hasta ahora la respuesta no estaba en ninguna parte
      // del producto: sólo en dos páginas que nadie sabía que existían.
      { id: "misDatos", parrafos: 3, nota: true, ruta: "/privacy" },
    ],
  },
  {
    id: "clientes",
    areas: ["clientes"],
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
    areas: ["dinero"],
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
    areas: ["campo"],
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
      { id: "ccq", parrafos: 3, nota: true, ruta: "/technicians", paises: ["CA"] },
      // Los papeles que genera la nómina de fuera. Sin esto, el botón de
      // Papeles en la ficha no lo abre nadie porque nadie sabe para qué es.
      { id: "papeles", parrafos: 3, nota: true, ruta: "/technicians", paises: ["CA"] },
      { id: "papelesGeneral", parrafos: 3, nota: true, ruta: "/technicians", paises: ["IT", "otros"] },
      // Una fecha de caducidad puesta al subir el papel es lo que convierte
      // un archivo guardado en un aviso a tiempo. Vale en todos los países.
      { id: "caducidades", parrafos: 3, nota: true, ruta: "/technicians" },
      // Lo que la Cassa Edile mira antes del saldo final. Quien se entera al
      // terminar la obra tiene quince días y una diferencia que pagar.
      { id: "congruita", parrafos: 4, nota: true, ruta: "/projects", paises: ["IT"] },
    ],
  },
  {
    id: "dinero",
    areas: ["dinero"],
    rutas: ["/invoicing", "/cobrar", "/payroll", "/reports", "/cost-tracking", "/settings/payments", "/settings/quickbooks"],
    temas: [
      // Lo de las facturas no se le enseña a quien todavía no puede emitirlas:
      // su respuesta es `impuestosOtros`, que dice por qué y a quién escribir.
      { id: "crearFactura", parrafos: 3, nota: true, ruta: "/invoicing", paises: ["CA", "IT"] },
      { id: "impuestos", parrafos: 3, paises: ["CA"] },
      { id: "impuestosItalia", parrafos: 3, nota: true, ruta: "/settings/payments", paises: ["IT"] },
      // La pregunta que hace cualquier impresa que subcontrata, y la que más
      // cuesta si se contesta mal: una factura con IVA que debía ir sin él.
      { id: "inversioneContabile", parrafos: 3, nota: true, ruta: "/invoicing", paises: ["IT"] },
      // En Italia un PDF no es una factura. Decirlo aquí es lo que evita que
      // alguien le mande a su cliente un papel que su commercialista rechaza.
      { id: "fatturaElettronica", parrafos: 3, nota: true, paises: ["IT"] },
      // La deducción del cliente depende de cómo paga, y el que lo sabe es
      // quien emite la factura: si el bonifico sale mal, la culpa vuelve aquí.
      { id: "bonusFiscale", parrafos: 3, nota: true, ruta: "/projects", paises: ["IT"] },
      { id: "impuestosOtros", parrafos: 3, nota: true, paises: ["otros"] },
      // Tres líneas de la nómina nacen a 0 % porque nadie de fuera las puede
      // saber: dependen del TD1 de cada persona, de la clasificación CNESST
      // de la empresa y de su masa salarial. La pantalla lo dice en la nota
      // de cada línea, pero a un 0 % se le pregunta al bot antes que leer una
      // nota — y hasta hoy el bot no tenía nada que contestar.
      { id: "tasasEnCero", parrafos: 4, nota: true, ruta: "/payroll", paises: ["CA"] },
      { id: "numeroFactura", parrafos: 2, paises: ["CA", "IT"] },
      { id: "cobrar", parrafos: 3, nota: true, ruta: "/settings/payments", paises: ["CA"] },
      // Donde todavía no hay tarjeta, la respuesta a «cómo cobro» no puede ser
      // «conecta Stripe»: es cómo apuntar lo que cobra por su cuenta.
      { id: "cobrarSinTarjeta", parrafos: 3, nota: true, ruta: "/invoicing", paises: ["IT"] },
      // El cliente delante y la factura en la pantalla: QR, enlace o lector.
      { id: "cobrarEnPersona", parrafos: 3, nota: true, ruta: "/cobrar", paises: ["CA"] },
      { id: "cobrarPorFuera", parrafos: 3, nota: true, ruta: "/invoicing", paises: ["CA", "IT"] },
      { id: "contable", parrafos: 2, ruta: "/reports" },
      // Lo previsto y lo gastado son cosas distintas y la pantalla lo enseña
      // en cinco columnas. Sin explicarlo, «previsto» se lee como un error.
      { id: "costos", parrafos: 3, nota: true, ruta: "/cost-tracking" },
      // Lo que se manda solo a QuickBooks y qué hacer cuando algo no llega.
      // Sin esto, la primera vez que una factura falla el contratista no sabe
      // ni que existe una pantalla donde mirarlo.
      { id: "quickbooks", parrafos: 4, nota: true, ruta: "/settings/quickbooks", paises: ["CA"] },
      { id: "quickbooksFalla", parrafos: 3, nota: true, ruta: "/settings/quickbooks", paises: ["CA"] },
      // El motivo más frecuente de que una factura no llegue, y el único que
      // se arregla en el QuickBooks de la persona y no aquí. Va aparte de
      // `quickbooksFalla` porque la respuesta no es «reintenta», son cuatro
      // pasos en una pantalla que no es nuestra.
      { id: "impuestoQuickBooks", parrafos: 4, nota: true, ruta: "/settings/quickbooks", paises: ["CA"] },
      // Lo que Stripe se lleva de cada cobro. Es la primera pregunta que hace
      // alguien que mira su banco después de cobrar una factura grande.
      { id: "comisionStripe", parrafos: 3, nota: true, ruta: "/invoicing", paises: ["CA"] },
      // A un contratista le venden un datáfono con cuota mensual en cuanto un
      // cliente le pide pagar con tarjeta en la obra. Ya tiene uno: su cuenta
      // de Stripe es completa y su móvil lee tarjetas. Esto se explica aquí
      // porque la pregunta llega antes de firmar, no después.
      { id: "cobrarConElMovil", parrafos: 4, nota: true, ruta: "/settings/payments", paises: ["CA"] },
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
      { id: "emitoFactura", parrafos: 3, nota: true, paises: ["CA", "IT"] },
      { id: "pagaCliente", parrafos: 2, paises: ["CA"] },
      { id: "doyCodigoCliente", parrafos: 3, nota: true },
      { id: "fichaTrabajador", parrafos: 3 },
      { id: "cierroOrden", parrafos: 2 },
      { id: "mandoAcuerdo", parrafos: 3, nota: true },
      { id: "emitoConQuickBooks", parrafos: 3, nota: true, paises: ["CA"] },
    ],
  },
  {
    id: "problemas",
    temas: [
      { id: "noVeObras", parrafos: 2, nota: true },
      { id: "horasEnCero", parrafos: 2 },
      { id: "noSeCobra", parrafos: 2, paises: ["CA"] },
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

/**
 * El árbol que ve un negocio de ese país: cada sección con sus temas, y sin
 * las secciones que se queden vacías.
 */
export function arbolDelPais(pais: string | null | undefined): SeccionDeAyuda[] {
  const grupo = grupoDePais(pais);
  return ARBOL_DE_AYUDA.map((seccion) => ({
    ...seccion,
    temas: seccion.temas.filter((tema) => !tema.paises || tema.paises.includes(grupo)),
  })).filter((seccion) => seccion.temas.length > 0);
}
