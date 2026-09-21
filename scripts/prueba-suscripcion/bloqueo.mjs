/**
 * Cuándo se para el sistema, y qué sigue abierto cuando se para.
 *
 *   node --experimental-strip-types scripts/prueba-suscripcion/bloqueo.mjs
 *
 * Existe por un fallo que hacía gratis el producto entero sin que nada
 * pareciera roto.
 *
 * La prueba de 30 días la damos nosotros: al darse de alta se escribe
 * `subscription_status = "trialing"` con una fecha a 30 días, y **no hay
 * suscripción en Stripe**, así que no hay webhook que venga nunca a cerrarla.
 * Mientras `trialing` bastó por sí solo para valer como acceso, esa fecha no
 * la miraba nadie: el día 31 se entraba igual, y el 300 también. La pantalla
 * de suscripción estaba puesta, se veía bien, y no obligaba a nadie a pasar
 * por ella.
 *
 * Y había un segundo fallo debajo: el bloqueo vivía **sólo en el navegador**.
 * El panel redirigía a la pantalla de pago y la API seguía contestando a todo,
 * así que bastaba con no usar el panel. Por eso aquí se comprueban las dos
 * mitades: cuándo se bloquea, y qué deja pasar el servidor cuando bloquea.
 */

import { accesoDe, abiertoSinSuscripcion, DIAS_DE_PRUEBA } from "../../shared/planes.ts";

let bien = 0;
let mal = 0;
function ok(que, real, esperado) {
  const igual = JSON.stringify(real) === JSON.stringify(esperado);
  console.log(`${igual ? "ok " : "MAL"} ${que}${igual ? "" : ` — esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`}`);
  igual ? bien++ : mal++;
}

const HOY = new Date("2026-09-21T12:00:00Z");
const dias = (n) => new Date(HOY.getTime() + n * 86_400_000).toISOString();

/* ---------- La prueba vence ---------- */

/** Un negocio recién dado de alta, tal y como lo escribe `POST /businesses`. */
const reciennacido = { plan: "prueba", estadoSuscripcion: "trialing", pruebaHasta: dias(DIAS_DE_PRUEBA) };

ok("Recién dado de alta, está de prueba",
   accesoDe(reciennacido, HOY), "prueba");
ok("El día antes de vencer, sigue de prueba",
   accesoDe({ ...reciennacido, pruebaHasta: dias(1) }, HOY), "prueba");
ok("Vencida la prueba y sin pagar, se bloquea — esto es lo que no pasaba",
   accesoDe({ ...reciennacido, pruebaHasta: dias(-1) }, HOY), "bloqueado");
ok("Y sigue bloqueado un año después, no «activo» por poner trialing",
   accesoDe({ ...reciennacido, pruebaHasta: dias(-365) }, HOY), "bloqueado");
ok("Pagar durante la prueba la sustituye",
   accesoDe({ plan: "chantier", estadoSuscripcion: "active", pruebaHasta: dias(-1) }, HOY), "activo");

/* ---------- Lo que no debe bloquear ---------- */

ok("El plan de la casa no caduca: Néstor no se queda fuera",
   accesoDe({ plan: "pilot", estadoSuscripcion: null, pruebaHasta: null }, HOY), "activo");
ok("Ni con una prueba vencida encima",
   accesoDe({ plan: "pilot", estadoSuscripcion: "canceled", pruebaHasta: dias(-90) }, HOY), "activo");
ok("Un impago no bloquea: Stripe reintenta durante días y suele ser la tarjeta",
   accesoDe({ plan: "chantier", estadoSuscripcion: "past_due", pruebaHasta: null }, HOY), "activo");
ok("Un `trialing` sin fecha es de Stripe: la lleva él, no la cerramos nosotros",
   accesoDe({ plan: "chantier", estadoSuscripcion: "trialing", pruebaHasta: null }, HOY), "activo");
ok("Una fecha ilegible no bloquea a nadie: el fallo sería nuestro",
   accesoDe({ plan: "prueba", estadoSuscripcion: "trialing", pruebaHasta: "no es una fecha" }, HOY), "prueba");

/* ---------- Cuando Stripe se rinde ---------- */

ok("Cancelada y sin prueba viva, se bloquea",
   accesoDe({ plan: "chantier", estadoSuscripcion: "canceled", pruebaHasta: dias(-40) }, HOY), "bloqueado");
ok("Impagada del todo, igual",
   accesoDe({ plan: "chantier", estadoSuscripcion: "unpaid", pruebaHasta: null }, HOY), "bloqueado");

/* ---------- Qué sigue abierto con el sistema parado ---------- */

/**
 * Las rutas de verdad, escritas como las ve el servidor dentro de `/api`.
 * Si alguna de estas familias se renombra, esta prueba es lo que lo dice —
 * antes lo que había en la lista era `suscripcion`, que ya no existía, y el
 * bloqueo se habría cerrado sobre su propia puerta de salida.
 */
ok("La puerta de pago queda abierta: si no, el bloqueo no tiene salida",
   abiertoSinSuscripcion("/subscription/checkout"), true);
ok("Entrar y salir de la cuenta, también",
   abiertoSinSuscripcion("/auth/me"), true);
ok("Llevarse sus datos: son suyos, y lo dice la Ley 25",
   abiertoSinSuscripcion("/export/pdf"), true);
ok("Pedir ayuda no se le cierra a nadie",
   abiertoSinSuscripcion("/soporte/ticket"), true);

ok("El resto del producto, no", [
  "/projects", "/invoices", "/payroll", "/reports", "/clients", "/estimates", "/expenses",
].filter(abiertoSinSuscripcion), []);

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
