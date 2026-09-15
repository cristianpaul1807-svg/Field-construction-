/**
 * El buzón de soporte, si el despliegue tiene uno.
 *
 * Se pregunta al servidor en vez de compilarlo en el paquete. Un `VITE_*` se
 * congela al construir, y casi todos los hostings inyectan las variables al
 * arrancar: puesto así, el botón de «Escríbenos» no habría aparecido nunca por
 * mucho que estuviera bien configurado, y eso es un fallo que no se puede
 * diagnosticar mirando la pantalla.
 *
 * Se pide una sola vez y se comparte la promesa: el aviso de fallo puede salir
 * en tres sitios a la vez, y tres peticiones para leer un correo son dos de más.
 */

let pedido: Promise<string | null> | null = null;

export function correoDeSoporte(): Promise<string | null> {
  if (pedido) return pedido;

  // Si alguien lo compiló en el paquete, vale igual y nos ahorramos la vuelta.
  const compilado = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim();
  if (compilado) {
    pedido = Promise.resolve(compilado);
    return pedido;
  }

  pedido = fetch("/api/public/config")
    .then((res) => (res.ok ? res.json() : null))
    .then((cuerpo: { supportEmail?: string } | null) => cuerpo?.supportEmail?.trim() || null)
    // Sin buzón se enseña el aviso igual, sólo que sin ese botón. Un fallo
    // leyendo la configuración no puede tapar el fallo que se estaba contando.
    .catch(() => null);
  return pedido;
}
