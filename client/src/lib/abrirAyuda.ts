/**
 * Abrir el bot de ayuda desde cualquier sitio, ya colocado en una respuesta.
 *
 * El bot vive en el marco del panel y guarda su estado dentro. Un aviso de
 * fallo que aparece en mitad de una pantalla necesita poder decirle «ábrete en
 * esto» sin que el estado del bot suba hasta la raíz sólo para eso.
 *
 * Un evento del navegador basta y no ata nada: si el bot no está montado —el
 * portal del cliente, la app del trabajador— el aviso sigue funcionando, y el
 * botón que abriría la ayuda se le pregunta antes con `hayAyuda()`.
 */

export const EVENTO_AYUDA = "abrir-ayuda";

export interface PeticionDeAyuda {
  seccion?: string;
  tema?: string;
}

export function abrirAyuda(seccion?: string, tema?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PeticionDeAyuda>(EVENTO_AYUDA, { detail: { seccion, tema } }));
}

/**
 * Si el bot está puesto en esta pantalla.
 *
 * El panel lo lleva; el portal del cliente y la app del trabajador no. Quien
 * ofrezca un botón de ayuda pregunta antes, porque un botón que no abre nada
 * es peor que no tener botón.
 */
let montado = 0;

export function registrarAyuda(): () => void {
  montado += 1;
  return () => {
    montado -= 1;
  };
}

export function hayAyuda(): boolean {
  return montado > 0;
}
