/**
 * Instalar la aplicación en el teléfono.
 *
 * Es una PWA: no está en ninguna tienda, se instala desde el propio navegador.
 * Eso está muy bien para nosotros —nada que aprobar, nada que actualizar a
 * mano— y es invisible para quien no lo sepa. Nadie va a descubrir solo que
 * esto se puede poner en la pantalla de inicio, así que hay que decírselo.
 *
 * El problema es que cada sitio lo hace distinto y sólo uno de ellos se puede
 * automatizar:
 *
 * - **Android y escritorio con Chrome o Edge** avisan con `beforeinstallprompt`
 *   y dejan abrir el diálogo de instalación desde un botón. Una pulsación.
 * - **iPhone y iPad con Safari** no tienen ninguna API. Hay que contar los
 *   pasos: Compartir → Añadir a pantalla de inicio.
 * - **iPhone con otro navegador** —o dentro de WhatsApp, que abre los enlaces
 *   en su propia ventana— directamente no lo ofrece. Enseñar ahí los pasos de
 *   Safari es enseñar botones que no existen en esa pantalla, así que lo que
 *   se dice es que lo abra en Safari.
 * - **Lo demás** no se sabe, y no se promete nada.
 *
 * Ese último caso importa más de lo que parece: al trabajador el enlace le
 * llega por WhatsApp, y si lo abre desde ahí está exactamente en la ventana
 * donde no se puede instalar.
 */

export type Camino = "boton" | "ios-safari" | "ios-otro" | "android-otro" | "ninguno";

/** Lo que Chrome pasa en `beforeinstallprompt`, que no está en lib.dom. */
type EventoDeInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let guardado: EventoDeInstalacion | null = null;
const avisos = new Set<() => void>();

function avisar() {
  avisos.forEach((f) => f());
}

/**
 * Se engancha al arrancar, desde `main.tsx`, y no desde el componente.
 *
 * `beforeinstallprompt` se dispara una vez y pronto — normalmente antes de que
 * React haya montado nada. Escucharlo desde un `useEffect` es llegar tarde: el
 * evento ya pasó, no se repite, y el botón de instalar no aparece nunca aunque
 * el navegador esté dispuesto.
 */
export function escucharLaInstalacion() {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Sin esto Chrome saca su propia barra, y entonces hay dos sitios desde
    // los que instalar diciendo cosas distintas.
    e.preventDefault();
    guardado = e as EventoDeInstalacion;
    avisar();
  });

  // Ya instalada: el ofrecimiento sobra y hay que retirarlo en el momento, no
  // en la siguiente carga.
  window.addEventListener("appinstalled", () => {
    guardado = null;
    avisar();
  });
}

export function alCambiar(f: () => void): () => void {
  avisos.add(f);
  return () => {
    avisos.delete(f);
  };
}

/** Abre el diálogo del navegador. Devuelve si acabó instalada. */
export async function instalar(): Promise<boolean> {
  if (!guardado) return false;
  const evento = guardado;
  // El evento sirve una sola vez. Se suelta antes de esperar la respuesta para
  // que una segunda pulsación no intente reusarlo y falle en silencio.
  guardado = null;
  avisar();
  await evento.prompt();
  const { outcome } = await evento.userChoice;
  return outcome === "accepted";
}

/**
 * Ya está instalada.
 *
 * `display-mode: standalone` lo dice en todas partes menos en iOS, que tiene su
 * propio `navigator.standalone` desde antes de que existiera el estándar.
 */
export function yaEstaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function esIOS(): boolean {
  const ua = navigator.userAgent;
  // El iPad moderno se presenta como un Mac. Lo que lo delata es que tenga
  // pantalla táctil, porque ningún Mac la tiene.
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Safari de verdad, y no una ventana incrustada.
 *
 * Todos los navegadores de iPhone usan el motor de Safari, así que todos dicen
 * «Safari» en su identificación. Lo que los separa es `Version/`: lo pone el
 * navegador completo y no lo ponen las ventanas que abren WhatsApp, Instagram
 * o Facebook dentro de sí mismas — que es justo por donde le va a llegar el
 * enlace al trabajador.
 */
function esSafariCompleto(): boolean {
  const ua = navigator.userAgent;
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false;
  return / Version\/\d/.test(ua);
}

export function caminoDeInstalacion(): Camino {
  if (typeof window === "undefined" || yaEstaInstalada()) return "ninguno";
  if (guardado) return "boton";
  if (esIOS()) return esSafariCompleto() ? "ios-safari" : "ios-otro";
  // Android sin el evento: o el navegador no lo soporta, o ya la tiene. Se
  // ofrece el camino por el menú, que existe en todos ellos.
  if (/Android/.test(navigator.userAgent)) return "android-otro";
  // Un escritorio que no ofreció el evento no tiene por dónde, y contarle a
  // alguien cómo instalar algo que su navegador no instala es hacerle perder
  // el tiempo.
  return "ninguno";
}
