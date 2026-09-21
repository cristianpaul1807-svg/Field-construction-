/**
 * Lo que Stripe manda, traducido a lo que guardamos.
 *
 * Tres reglas y las tres han fallado en producción, porque las tres se ven
 * bien leyéndolas. Están juntas y en `shared/` —sin ningún `import` de valor—
 * para que `scripts/prueba-suscripcion/mapeo.mjs` pueda llamar a **estas** y
 * no a un espejo suyo que se quede atrás.
 *
 * ## La fecha de renovación
 *
 * Stripe movió `current_period_end` de la suscripción **al artículo** —una
 * suscripción puede tener artículos con periodos distintos—. Leyéndolo sólo de
 * arriba sale `null` con cualquier versión reciente de la API, y la fecha de
 * renovación se guarda vacía: el negocio paga y su pantalla no le dice hasta
 * cuándo, que es justo la pregunta por la que abre esa pantalla.
 *
 * Lo que lo hace traicionero es que no se ve leyendo el código: el campo está
 * donde siempre estuvo. Y con una suscripción escrita a mano la prueba pasa,
 * porque uno se la escribe como cree que es. Salió haciendo una llamada de
 * verdad, y de ahí la regla de `scripts/prueba-suscripcion/mapeo.mjs`: sus
 * respuestas están copiadas tal cual de la API.
 *
 * La copia ya se quedó atrás una vez: seguía probando un `guardarSuscripcion`
 * que el servidor ya no tenía, mientras la ruta viva volvía a leer sólo de
 * arriba.
 *
 * ## Qué plan se ha contratado
 *
 * Esto se decidía comparando el identificador del precio contra cuatro
 * `price_1UGhMx…` escritos a mano, y lo que hacía cuando no casaba ninguno era
 * **no hacer nada**: `if (plan)` y el `update` entero se saltaba en silencio.
 * O sea: el negocio paga, Stripe confirma el cobro, y su plan no cambia nunca.
 * Ha pagado y sigue bloqueado, y en los registros no hay ni un error.
 *
 * Y casar no casaba, porque un identificador de precio es distinto en cada
 * cuenta de Stripe: en cuanto la clave del servidor pasa de la cuenta de
 * pruebas a la real, esos cuatro no existen.
 *
 * Así que el plan se lee de lo que el propio precio lleva encima —que es lo
 * que `scripts/stripe-precios.mjs` le escribe— y por tres caminos, de más
 * fiable a menos. Si ninguno contesta, quien llama tiene que **gritar**, no
 * seguir como si nada.
 */

/** Sólo lo que hace falta mirar. Cualquier `Stripe.Subscription` encaja. */
export type SuscripcionConPeriodo = {
  current_period_end?: number | null;
  items?: { data?: ({ current_period_end?: number | null } | undefined)[] } | null;
};

/** Los segundos unix de la renovación, del artículo si está y de arriba si no. */
export function renovacionUnix(sub: SuscripcionConPeriodo): number | null {
  return sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end ?? null;
}

export function renovacionIso(sub: SuscripcionConPeriodo): string | null {
  const unix = renovacionUnix(sub);
  return typeof unix === "number" ? new Date(unix * 1000).toISOString() : null;
}

/** Un precio de Stripe, con lo poco que hace falta mirarle. */
export type PrecioDeStripe = {
  id?: string | null;
  lookup_key?: string | null;
  metadata?: { plan?: string | null; periodo?: string | null } | null;
  recurring?: { interval?: string | null } | null;
};

/** Los dos planes que se venden. Los otros no se contratan, se asignan. */
const PLANES_QUE_SE_VENDEN = ["chantier", "entreprise"];

/**
 * Qué plan es este precio, o `null` si no hay forma de saberlo.
 *
 * `metadata.plan` primero porque es lo que el script escribe a propósito y no
 * se lo lleva por delante nadie editando nombres en el panel de Stripe. La
 * clave de búsqueda después, que lleva el plan en su primera mitad. Y los
 * identificadores viejos al final, para las suscripciones que ya se vendieron
 * con ellos: el día que cambiamos de cuenta no se puede dejar de entender a
 * quien lleva un año pagando.
 */
export function planDelPrecio(precio: PrecioDeStripe | null | undefined, heredados: Record<string, string> = {}): string | null {
  if (!precio) return null;

  const porEtiqueta = precio.metadata?.plan;
  if (porEtiqueta && PLANES_QUE_SE_VENDEN.includes(porEtiqueta)) return porEtiqueta;

  const porClave = precio.lookup_key?.split("_")[0];
  if (porClave && PLANES_QUE_SE_VENDEN.includes(porClave)) return porClave;

  const porIdViejo = precio.id ? heredados[precio.id] : undefined;
  if (porIdViejo && PLANES_QUE_SE_VENDEN.includes(porIdViejo)) return porIdViejo;

  return null;
}

/**
 * Mensual o anual, de lo que Stripe cobra de verdad.
 *
 * De `recurring.interval` y no de la clave de búsqueda: el intervalo es cómo
 * se cobra, y si alguna vez no coincidieran manda el cobro.
 */
export function periodoDelPrecio(precio: PrecioDeStripe | null | undefined): "mes" | "ano" | null {
  const intervalo = precio?.recurring?.interval;
  if (intervalo === "month") return "mes";
  if (intervalo === "year") return "ano";
  const porClave = precio?.lookup_key?.split("_")[1];
  return porClave === "mes" || porClave === "ano" ? porClave : null;
}
