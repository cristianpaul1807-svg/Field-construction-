/**
 * La historia que cuentan todos los tutoriales: el mismo cliente, la misma
 * obra, de un vídeo al siguiente. Y lo que hace falta para que cada vídeo
 * pueda grabarse solo y repetirse sin dejar duplicados en la cuenta.
 */
// Sin correo, a propósito: con uno, cada soumission que se envía en un vídeo
// le llega de verdad a alguien. Con la dirección del dueño (con «+tremblay»)
// le llegaron a él dos en una tarde. El cliente la recibe en su portal.
export const CLIENTE = {
  fr: { name: "Famille Tremblay", phone: "514 555-0199", address: "4521, rue Fabre, Montréal (Québec) H2J 3V2" },
  it: { name: "Famiglia Rossi", phone: "333 555 0199", address: "Via Garibaldi 8, 00153 Roma RM" },
};

/** El cliente de la historia, creado si no está. Devuelve su id. */
export async function asegurarCliente(api, idioma) {
  const datos = CLIENTE[idioma];
  const lista = await api("GET", "/api/clients");
  const ya = (Array.isArray(lista.datos) ? lista.datos : []).find((c) => c.name === datos.name);
  if (ya) {
    // Y si alguna vez se le puso uno, se le quita antes de grabar.
    if (ya.email) await api("PATCH", `/api/clients/${ya.id}`, { email: "" });
    return ya.id;
  }
  const nuevo = await api("POST", "/api/clients", datos);
  if (!nuevo.ok) throw new Error(`no se pudo crear el cliente de demostración (${nuevo.estado})`);
  return nuevo.datos.id;
}

/** Borra las soumissions/preventivi del cliente de la historia (de grabaciones anteriores). */
export async function borrarPresupuestosDe(api, idioma) {
  const nombre = CLIENTE[idioma].name;
  const lista = await api("GET", "/api/estimates");
  for (const e of (Array.isArray(lista.datos) ? lista.datos : []).filter((e) => e.clientName === nombre)) {
    await api("DELETE", `/api/estimates/${e.id}`);
  }
}

/**
 * Las siete y media de la mañana, se grabe cuando se grabe.
 *
 * La jornada del trabajador empieza a las 7:00 y la agenda se abre en la hora
 * actual: grabado a las cuatro de la tarde en Montreal, se veía la tarde vacía
 * y un fichaje de entrada a las 16:25. El móvil del vídeo se pone en la zona
 * horaria donde ahora son entre las 7:00 y las 8:00; lo único que cambia es
 * la hora que enseña la pantalla, y la del servidor sigue siendo la de verdad.
 *
 * Devuelve la zona para el navegador y `hora(h, m)`, ese momento de hoy en
 * esa zona, para programarle el trabajo del día.
 */
export function primeraHora() {
  const ahora = new Date();
  let desfase = Math.round(7.5 - (ahora.getUTCHours() + ahora.getUTCMinutes() / 60));
  while (desfase < -12) desfase += 24;
  while (desfase > 14) desfase -= 24;
  // Los nombres Etc/GMT llevan el signo al revés: UTC+11 es «Etc/GMT-11».
  const zona = desfase === 0 ? "Etc/UTC" : `Etc/GMT${desfase > 0 ? "-" : "+"}${Math.abs(desfase)}`;
  const local = new Date(ahora.getTime() + desfase * 3_600_000);
  const medianoche = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - desfase * 3_600_000;
  return { zona, hora: (h, m = 0) => new Date(medianoche + (h * 60 + m) * 60_000).toISOString() };
}

/** El trabajador de la historia: en la obra de la familia, y con su propio código. */
export const TRABAJADOR = {
  fr: { name: "Jean-Philippe Roy", role: "Charpentier-menuisier", phone: "514 555-0177", tarea: "Démolition de la cuisine", obra: { latitude: 45.5299, longitude: -73.5806 } },
  it: { name: "Marco Bianchi", role: "Muratore", phone: "333 555 0177", tarea: "Demolizione della cucina", obra: { latitude: 41.8846, longitude: 12.4731 } },
};
