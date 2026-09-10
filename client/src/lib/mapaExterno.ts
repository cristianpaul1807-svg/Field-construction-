/**
 * Abrir un punto en la aplicación de mapas que la persona tiene de verdad.
 *
 * Las coordenadas del fichaje ya se podían pulsar, pero llevaban a
 * OpenStreetMap: enseña el punto y poco más. Quien está revisando horas suele
 * querer lo siguiente —cómo se llega, qué hay en esa esquina, la vista de
 * calle—, y eso lo da la aplicación de mapas del teléfono, no una web.
 *
 * En iPhone y Mac se abre Mapas de Apple, que está siempre instalada. En lo
 * demás, Google Maps, cuyo enlace universal abre la aplicación si está y la
 * web si no. Los dos enlaces llevan además el punto listo para pedir ruta.
 */
export function enlaceDeMapa(lat: number, lng: number, etiqueta?: string): string {
  const punto = `${lat},${lng}`;
  const esApple =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

  if (esApple) {
    // ll= centra el mapa y q= pone la chincheta con su nombre. Sin ll, Apple
    // interpreta q como una búsqueda de texto y puede acabar en otra ciudad.
    const nombre = etiqueta ? `&q=${encodeURIComponent(etiqueta)}` : `&q=${punto}`;
    return `https://maps.apple.com/?ll=${punto}${nombre}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${punto}`;
}
