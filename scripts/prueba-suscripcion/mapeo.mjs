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
  const plan = precio?.metadata?.plan;
  if (!plan) return null;
  const renueva = articulo?.current_period_end ?? sub.current_period_end ?? null;
  return {
    subscription_plan: sub.status === "active" || sub.status === "trialing" ? plan : "prueba",
    subscription_status: sub.status,
    subscription_interval: precio?.recurring?.interval === "year" ? "ano" : "mes",
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

/* ---------- Quién puede entrar ---------- */

const { accesoDe, abiertoSinSuscripcion } = await import("/home/user/Field-construction-/shared/planes.ts");

const AHORA = new Date("2026-09-17T12:00:00Z");
const enUnaSemana = "2026-09-24T12:00:00Z";
const laSemanaPasada = "2026-09-10T12:00:00Z";

ok("Pilot no caduca nunca, aunque la prueba venciera hace un año",
   accesoDe({ plan: "pilot", estadoSuscripcion: null, pruebaHasta: "2025-01-01T00:00:00Z" }, AHORA), "activo");
ok("Pagando, se entra",
   accesoDe({ plan: "chantier", estadoSuscripcion: "active", pruebaHasta: null }, AHORA), "activo");
ok("En los 30 días de Stripe, se entra",
   accesoDe({ plan: "chantier", estadoSuscripcion: "trialing", pruebaHasta: enUnaSemana }, AHORA), "activo");
ok("Un impago NO bloquea: Stripe sigue reintentando",
   accesoDe({ plan: "chantier", estadoSuscripcion: "past_due", pruebaHasta: null }, AHORA), "activo");
ok("Prueba sin tarjeta, aún viva",
   accesoDe({ plan: "prueba", estadoSuscripcion: null, pruebaHasta: enUnaSemana }, AHORA), "prueba");
ok("Prueba vencida y nada contratado: bloqueado",
   accesoDe({ plan: "prueba", estadoSuscripcion: null, pruebaHasta: laSemanaPasada }, AHORA), "bloqueado");
ok("Cancelada y la prueba ya pasó: bloqueado",
   accesoDe({ plan: "chantier", estadoSuscripcion: "canceled", pruebaHasta: laSemanaPasada }, AHORA), "bloqueado");
ok("Cancelada pero el periodo pagado sigue corriendo: se entra hasta el final",
   accesoDe({ plan: "chantier", estadoSuscripcion: "active", pruebaHasta: null }, AHORA), "activo");
ok("Sin fecha y sin nada: bloqueado",
   accesoDe({ plan: "prueba", estadoSuscripcion: null, pruebaHasta: null }, AHORA), "bloqueado");
ok("Una fecha ilegible no bloquea a nadie por un fallo nuestro",
   accesoDe({ plan: "prueba", estadoSuscripcion: null, pruebaHasta: "vete a saber" }, AHORA), "bloqueado");

ok("Bloqueado, se puede pagar", abiertoSinSuscripcion("/suscripcion/checkout"), true);
ok("Bloqueado, se puede entrar y salir", abiertoSinSuscripcion("/auth/me"), true);
ok("Bloqueado, se puede escribir a soporte", abiertoSinSuscripcion("/soporte/ticket"), true);
ok("Bloqueado, se puede llevar sus datos", abiertoSinSuscripcion("/suscripcion/mis-datos"), true);
ok("Bloqueado, NO se factura", abiertoSinSuscripcion("/invoices"), false);
ok("Bloqueado, NO se hace nómina", abiertoSinSuscripcion("/payroll"), false);

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
