/**
 * Cuándo se renueva una suscripción, según lo que manda Stripe.
 *
 * Una función sola en su archivo, y con razón: es el mismo fallo tres veces.
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
 * Vive en `shared/` y sin ningún `import` de valor para que esa prueba pueda
 * llamar a **esta** función en vez de a una copia. La copia ya se quedó atrás
 * una vez: seguía probando un `guardarSuscripcion` que el servidor ya no tenía,
 * mientras la ruta viva volvía a leer sólo de arriba.
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
