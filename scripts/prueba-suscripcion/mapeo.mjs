/**
 * Lo que guardaríamos a partir de lo que Stripe manda de verdad.
 *
 *   node scripts/prueba-suscripcion/mapeo.mjs
 *
 * Las suscripciones de ejemplo de aquí abajo **no están inventadas**: son
 * respuestas reales de la API, copiadas tal cual. Es lo único que sirve,
 * porque el fallo que esto encontró la primera vez fue exactamente el de
 * inventárselas: `current_period_end` ya no está en la suscripción sino dentro
 * del artículo, y leyéndolo del sitio de siempre la fecha de renovación se
 * guardaba vacía. Con un objeto escrito a mano habría pasado la prueba.
 *
 * Aquí sólo se comprueba la decisión: qué plan y qué estado quedan escritos.
 * Escribir en la base es de la ruta, y eso se prueba con Stripe delante.
 */

import { renovacionUnix, planDelPrecio, periodoDelPrecio } from "../../shared/suscripcionStripe.ts";

/** Los cuatro con los que se vendió antes, copiados de server/subscription.ts. */
const HEREDADOS = {
  price_1UGhMxCoxo1rqCJcc3GAVUcV: "chantier",
  price_1UGhMxCoxo1rqCJcN60TxdoV: "chantier",
  price_1UGhMoCoxo1rqCJcwQwwJPvw: "entreprise",
  price_1UGhMoCoxo1rqCJcmVnHAMMn: "entreprise",
};

let bien = 0;
let mal = 0;
function ok(que, real, esperado) {
  const igual = JSON.stringify(real) === JSON.stringify(esperado);
  console.log(`${igual ? "ok " : "MAL"} ${que}${igual ? "" : ` — esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`}`);
  igual ? bien++ : mal++;
}

/** La misma decisión que toma `guardarSuscripcion` en server/api.ts. */
function loQueGuardariamos(sub) {
  const articulo = sub.items?.data?.[0];
  const precio = articulo?.price;
  // Las de verdad, no una copia: si el webhook vuelve a decidir el plan de
  // otra manera, esta prueba es lo que lo dice.
  const plan = planDelPrecio(precio);
  if (!plan) return null;
  // La de verdad, no una copia: si la ruta viva vuelve a leer sólo de arriba,
  // esta prueba es lo que lo dice.
  const renueva = renovacionUnix(sub);
  return {
    subscription_plan: sub.status === "active" || sub.status === "trialing" ? plan : "prueba",
    subscription_status: sub.status,
    subscription_interval: periodoDelPrecio(precio),
    subscription_period_end: renueva ? new Date(renueva * 1000).toISOString() : null,
    subscription_cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
  };
}

/* Respuesta real de Stripe: Chantier anual, recién creada, en prueba. */
const enPrueba = {
  id: "sub_1UGdBpCrTg1fPYe0RuJr8joZ",
  status: "trialing",
  customer: "cus_VHBYwFdO4TkAZT",
  cancel_at_period_end: false,
  trial_end: 1792235357,
  items: {
    data: [
      {
        current_period_end: 1792235357,
        price: {
          id: "price_1UGd4XCrTg1fPYe0QEKOfelR",
          lookup_key: "chantier_ano",
          metadata: { periodo: "ano", plan: "chantier" },
          recurring: { interval: "year", interval_count: 1 },
        },
      },
    ],
  },
};

const r = loQueGuardariamos(enPrueba);
ok("En prueba se abre el plan entero", r.subscription_plan, "chantier");
ok("El estado se guarda tal cual de Stripe", r.subscription_status, "trialing");
ok("El periodo sale del precio, no de lo que pidió nadie", r.subscription_interval, "ano");
ok("La fecha de renovación sale del artículo", r.subscription_period_end, new Date(1792235357 * 1000).toISOString());
ok("Y la de fin de prueba", r.trial_ends_at, new Date(1792235357 * 1000).toISOString());
ok("No está cancelada", r.subscription_cancel_at_period_end, false);

/* La misma, ya pagando, mensual y con la cancelación pedida. */
const cancelando = {
  ...enPrueba,
  status: "active",
  cancel_at_period_end: true,
  trial_end: null,
  items: {
    data: [
      {
        current_period_end: 1792235357,
        price: { metadata: { periodo: "mes", plan: "entreprise" }, recurring: { interval: "month" } },
      },
    ],
  },
};
const c = loQueGuardariamos(cancelando);
ok("Pagando, el plan es el del precio", c.subscription_plan, "entreprise");
ok("Mensual", c.subscription_interval, "mes");
ok("Cancelada al final del periodo", c.subscription_cancel_at_period_end, true);
ok("Sin prueba, la fecha queda vacía", c.trial_ends_at, null);

/* Impago que Stripe ya dio por perdido. */
const impagada = { ...cancelando, status: "unpaid", cancel_at_period_end: false };
ok("Un estado que no es active ni trialing cierra el plan", loQueGuardariamos(impagada).subscription_plan, "prueba");

/* Un precio sin la etiqueta del plan: no se toca nada. */
const sinEtiqueta = { ...enPrueba, items: { data: [{ price: { metadata: {} } }] } };
ok("Sin plan en el precio no se escribe nada", loQueGuardariamos(sinEtiqueta), null);

/* Una cuenta con la API antigua, que lo manda arriba. */
const apiVieja = {
  ...enPrueba,
  current_period_end: 1792235357,
  items: { data: [{ price: { metadata: { plan: "chantier" }, recurring: { interval: "year" } } }] },
};
ok("La API antigua también se entiende", loQueGuardariamos(apiVieja).subscription_period_end, new Date(1792235357 * 1000).toISOString());

/* ---------- Qué plan se ha contratado ---------- */

/**
 * Lo que decidía esto antes era comparar el identificador contra cuatro
 * `price_1…` escritos a mano, y cuando no casaba ninguno **no hacía nada**: el
 * negocio pagaba, Stripe confirmaba, y su plan no cambiaba nunca. Y no casaba,
 * porque un identificador de precio es distinto en cada cuenta de Stripe.
 */
ok("De la etiqueta que le pone nuestro script",
   planDelPrecio({ id: "price_loquesea", metadata: { plan: "entreprise" } }), "entreprise");
ok("De la clave de búsqueda si no hay etiqueta",
   planDelPrecio({ id: "price_loquesea", lookup_key: "chantier_ano" }), "chantier");
ok("De un identificador viejo, para quien ya lo estaba pagando",
   planDelPrecio({ id: "price_1UGhMoCoxo1rqCJcwQwwJPvw" }, HEREDADOS), "entreprise");
ok("Un precio de otra cuenta, sin nada encima, no se inventa un plan",
   planDelPrecio({ id: "price_deOtraCuenta" }), null);
ok("Y un plan que no vendemos tampoco cuela",
   planDelPrecio({ id: "price_x", metadata: { plan: "fondateur" } }), null);

ok("Mensual, de lo que Stripe cobra de verdad",
   periodoDelPrecio({ recurring: { interval: "month" }, lookup_key: "chantier_mes" }), "mes");
ok("Anual, igual",
   periodoDelPrecio({ recurring: { interval: "year" }, lookup_key: "chantier_ano" }), "ano");
ok("Manda el cobro, no la clave, si no coincidieran",
   periodoDelPrecio({ recurring: { interval: "month" }, lookup_key: "chantier_ano" }), "mes");

/* ---------- La fecha de renovación, en los dos sitios ---------- */

/**
 * El mismo fallo ha vuelto dos veces, así que se comprueba la función de verdad
 * —`shared/renovacion.ts`— con las dos formas que manda Stripe.
 */
ok("Del artículo, que es donde lo pone la API de hoy",
   renovacionUnix({ items: { data: [{ current_period_end: 1792235357 }] } }), 1792235357);
ok("De arriba, que es donde lo ponía antes",
   renovacionUnix({ current_period_end: 1792235357, items: { data: [{}] } }), 1792235357);
ok("El artículo manda si están los dos: es el periodo de lo contratado",
   renovacionUnix({ current_period_end: 1, items: { data: [{ current_period_end: 2 }] } }), 2);
ok("Sin ninguno, null y no una fecha de 1970",
   renovacionUnix({ items: { data: [{}] } }), null);
ok("Una suscripción sin artículos no rompe",
   renovacionUnix({}), null);

/* ---------- Quién puede entrar ----------
 *
 * Ya no está aquí: vive en `bloqueo.mjs`, que lo cubre entero —cuándo vence la
 * prueba y qué sigue abierto con el sistema parado—. Lo que había en este
 * hueco era media copia de aquello, y llegó a discrepar: daba por buenas dos
 * rutas `/suscripcion/*` que ya no existen, y esperaba que una fecha ilegible
 * bloqueara a alguien justo debajo de un texto que decía lo contrario.
 */

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
