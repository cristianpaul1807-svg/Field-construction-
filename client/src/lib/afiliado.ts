/**
 * El código de quien trajo a este visitante.
 *
 * Llega en la dirección —`?ref=ABCD2345`— y hace falta mucho después: alguien
 * abre el enlace un martes, mira el sitio, y se da de alta el viernes. Entre
 * una cosa y otra hay recargas, pestañas nuevas y varias pantallas, así que el
 * código tiene que sobrevivir a todo eso o la atribución no vale nada.
 *
 * Se guarda en el navegador y se manda una sola vez, al crear el negocio. A
 * partir de ahí manda la base de datos, no esto: quien ya está atribuido no se
 * reatribuye por volver a pinchar otro enlace.
 */

const CLAVE = "logiciel.afiliado";

/**
 * Cuánto dura. Noventa días, que es lo que promete el contrato.
 *
 * Más largo sería regalar comisiones por una visita que nadie recuerda; más
 * corto haría discutible cada caso, y discutir una comisión con quien te trae
 * clientes cuesta más que pagarla.
 */
const DIAS = 90;

interface Guardado {
  codigo: string;
  visto: number;
}

/**
 * Apunta el código si la dirección lo trae.
 *
 * **El primero se lo queda.** Si ya hay uno guardado y sigue vivo, un enlace
 * nuevo no lo pisa: quien lo descubrió por alguien no deja de haberlo
 * descubierto por alguien porque luego pinchara otro sitio.
 */
export function recordarAfiliado(busqueda: string = window.location.search): void {
  try {
    const codigo = new URLSearchParams(busqueda).get("ref")?.trim().toUpperCase();
    if (!codigo || !/^[A-Z0-9]{4,16}$/.test(codigo)) return;
    if (codigoDeAfiliado()) return;
    window.localStorage.setItem(CLAVE, JSON.stringify({ codigo, visto: Date.now() } satisfies Guardado));
  } catch {
    // Ventana privada, almacenamiento bloqueado o lleno. Se pierde la
    // atribución de esa visita y no pasa nada más: nunca puede impedir que
    // alguien se dé de alta.
  }
}

/** El código vivo, o `null`. */
export function codigoDeAfiliado(): string | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const guardado = JSON.parse(crudo) as Partial<Guardado>;
    if (typeof guardado?.codigo !== "string" || typeof guardado?.visto !== "number") return null;
    if (Date.now() - guardado.visto > DIAS * 86_400_000) {
      window.localStorage.removeItem(CLAVE);
      return null;
    }
    return guardado.codigo;
  } catch {
    return null;
  }
}

/**
 * Lo borra, una vez usado.
 *
 * Si no, alguien que da de alta dos negocios desde el mismo navegador —un
 * contable montándole la cuenta a dos clientes— le atribuiría los dos al mismo
 * enlace sin querer.
 */
export function olvidarAfiliado(): void {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // Igual que arriba: no hay nada que hacer y nada que romper.
  }
}
