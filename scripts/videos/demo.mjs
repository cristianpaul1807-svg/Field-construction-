/**
 * La historia que cuentan todos los tutoriales: el mismo cliente, la misma
 * obra, de un vídeo al siguiente. Y lo que hace falta para que cada vídeo
 * pueda grabarse solo y repetirse sin dejar duplicados en la cuenta.
 */
export const CLIENTE = {
  fr: { name: "Famille Tremblay", phone: "514 555-0199", email: "progetmanagement+tremblay@gmail.com", address: "4521, rue Fabre, Montréal (Québec) H2J 3V2" },
  it: { name: "Famiglia Rossi", phone: "333 555 0199", email: "progetmanagement+rossi@gmail.com", address: "Via Garibaldi 8, 00153 Roma RM" },
};

/** El cliente de la historia, creado si no está. Devuelve su id. */
export async function asegurarCliente(api, idioma) {
  const datos = CLIENTE[idioma];
  const lista = await api("GET", "/api/clients");
  const ya = (Array.isArray(lista.datos) ? lista.datos : []).find((c) => c.name === datos.name);
  if (ya) return ya.id;
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
