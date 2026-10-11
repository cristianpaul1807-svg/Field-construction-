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
