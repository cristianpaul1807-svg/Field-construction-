/**
 * Copia fiel de `areasDelRol` de `server/supabaseAuth.ts`.
 *
 * Se duplica para poder probarla sin arrastrar Supabase, WebSocket y el resto
 * del servidor a una prueba de nueve líneas. Si se toca allí, se toca aquí —
 * y la prueba de abajo es la que avisa, porque comprueba exactamente los
 * valores que hay hoy en la base.
 */
const AREAS = ["campo", "clientes", "dinero", "personas", "ajustes"];

export function areasDelRol(rol) {
  if (!rol || !Array.isArray(rol.permissions)) return null;
  const areas = rol.permissions.filter((p) => AREAS.includes(p));
  return areas.length > 0 ? areas : null;
}
