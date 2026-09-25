import { lazy, type ComponentType } from "react";

const CLAVE = "fsm-recarga-por-version";
/** Menos que esto entre dos recargas es un bucle, no un despliegue. */
const ENTRE_RECARGAS_MS = 15_000;

/**
 * Una pantalla que se baja cuando alguien la abre, no antes.
 *
 * El trabajador que abre `/campo` en la furgoneta se bajaba el panel entero
 * —nómina, informes, presupuestos— para ver sus obras del día. Partido por
 * pantalla, cada uno baja lo suyo.
 *
 * El precio de partir es este: quien tenía la pestaña abierta antes de un
 * despliegue pide un trozo con el nombre de la versión anterior, que ya no
 * existe, y la pantalla revienta al pulsar en el menú. Se recarga una vez
 * para coger la versión nueva. Si vuelve a fallar enseguida no es eso —es
 * que no hay red, o el trozo está roto— y se deja llegar al ErrorBoundary en
 * vez de recargar para siempre.
 */
export function perezosa<T extends ComponentType<any>>(cargar: () => Promise<{ default: T }>) {
  return lazy(() =>
    cargar().catch((err: unknown) => {
      let anterior = 0;
      try {
        anterior = Number(sessionStorage.getItem(CLAVE) ?? 0);
        sessionStorage.setItem(CLAVE, String(Date.now()));
      } catch {
        // Sin almacenamiento no hay forma de saber si ya se recargó: mejor el
        // aviso de error que arriesgar un bucle.
        throw err;
      }
      if (Date.now() - anterior < ENTRE_RECARGAS_MS) throw err;
      window.location.reload();
      return new Promise<{ default: T }>(() => {});
    }),
  );
}
