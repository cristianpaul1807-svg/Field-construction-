/**
 * A dónde iba la persona antes de que le pidiéramos entrar.
 *
 * Existe por los enlaces que llegan de fuera. Intuit guarda una dirección de
 * «volver a conectar» y se la enseña al contratista dentro de QuickBooks;
 * quien la pulsa casi nunca tiene la sesión abierta, así que aterriza en el
 * inicio, entra, y se queda en el panel sin la menor idea de que venía a
 * arreglar una conexión. El enlace hace exactamente lo que no debe: te lleva
 * al edificio correcto y te suelta en el vestíbulo.
 *
 * `sessionStorage` y no `localStorage` a propósito: esto vale para el salto
 * que se está dando ahora mismo. Una pestaña que se cerró ayer no debe
 * secuestrar el próximo inicio de sesión.
 */

const CLAVE = "fsm-destino";

/** Sólo rutas de aquí dentro. Una dirección absoluta sería un redirector abierto. */
function esNuestra(ruta: string): boolean {
  return ruta.startsWith("/") && !ruta.startsWith("//") && ruta !== "/";
}

export function recordarDestino(ruta: string): void {
  try {
    if (esNuestra(ruta)) sessionStorage.setItem(CLAVE, ruta);
  } catch {
    // Navegación privada con el almacenamiento cerrado. Se pierde el destino,
    // que es justo lo que pasaba antes: no es motivo para romper el login.
  }
}

/**
 * Lo devuelve y lo olvida. Se consume una sola vez: si no, cada vuelta a la
 * pantalla de inicio durante la misma sesión te devolvería al mismo sitio.
 */
export function tomarDestino(): string | null {
  try {
    const ruta = sessionStorage.getItem(CLAVE);
    sessionStorage.removeItem(CLAVE);
    return ruta && esNuestra(ruta) ? ruta : null;
  } catch {
    return null;
  }
}
