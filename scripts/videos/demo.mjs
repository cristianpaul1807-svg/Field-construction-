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

/**
 * Borra las soumissions/preventivi del cliente de la historia que quedaron a
 * medias en grabaciones anteriores. Las aceptadas no: de ellas salen la obra,
 * su plan de pagos y sus facturas, que es lo que enseñan los vídeos 4 y 5.
 */
export async function borrarPresupuestosDe(api, idioma) {
  const nombre = CLIENTE[idioma].name;
  const lista = await api("GET", "/api/estimates");
  for (const e of (Array.isArray(lista.datos) ? lista.datos : []).filter((e) => e.clientName === nombre && e.status !== "aceptado")) {
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

/** Las líneas de la soumission de la historia: el baño de la familia. */
export const LINEAS = {
  fr: [
    { zona: "Salle de bain", categoria: "Materiales", item: "Céramique murale 12 x 24 po", cantidad: 120, unidad: "pi²", precio: 6.5 },
    { zona: "Salle de bain", categoria: "Mano de obra", item: "Carreleur", cantidad: 24, unidad: "h", precio: 65 },
    { zona: "Salle de bain", categoria: "Materiales", item: "Vanité 36 po avec comptoir", cantidad: 1, unidad: "unité", precio: 890 },
  ],
};

/**
 * Una soumission ya hecha, fuera de cámara, para los vídeos que empiezan
 * después: el Short de la firma necesita una enviada, el de las taxes una en
 * borrador. Así cada Short se graba solo, sin depender de que otro vaya antes.
 *
 * `enviada`: la deja en «enviado», que es lo que el cliente ve para firmar.
 * El cliente de la historia no tiene correo, así que no le llega nada a nadie.
 */
export async function soumissionPreparada(api, idioma, { enviada = false, margen = 15, perdidas = 5 } = {}) {
  const clienteId = await asegurarCliente(api, idioma);
  const nueva = await api("POST", "/api/estimates", { clientId: clienteId });
  const id = nueva.datos?.id;
  if (!id) throw new Error(`no se pudo crear la soumission de demostración (${nueva.estado})`);
  for (const l of LINEAS[idioma]) {
    const r = await api("POST", `/api/estimates/${id}/lines`, {
      zone: l.zona, category: l.categoria, itemName: l.item, quantity: l.cantidad, unit: l.unidad, unitCost: l.precio, visibleToClient: true,
    });
    if (!r.ok) throw new Error(`no se pudo añadir la línea «${l.item}» (${r.estado})`);
  }
  await api("PATCH", `/api/estimates/${id}`, { marginType: "global", marginPercent: margen, wastePercent: perdidas });
  if (enviada) {
    const r = await api("PATCH", `/api/estimates/${id}/status`, { status: "enviado" });
    if (!r.ok) throw new Error(`no se pudo marcar como enviada (${r.estado})`);
  }
  return id;
}

/**
 * El trabajador de la historia, listo para grabar: dado de alta, con su
 * jornada de hoy (7:00–15:30 en la hora de `manana`) en la obra de la
 * familia, sin lo programado en grabaciones anteriores y sin fichajes abiertos.
 *
 * `codigo`: genera uno nuevo y lo devuelve. Sin él, el código se genera
 * delante de la cámara, desde el panel.
 */
export async function trabajadorPreparado(api, idioma, manana, { codigo = true } = {}) {
  const quien = TRABAJADOR[idioma];
  const rol = ((await api("GET", "/api/worker-roles")).datos ?? []).find((r) => r.name === "trabajador_de_campo");
  if (!rol) throw new Error("el negocio no tiene el rol de trabajador de campo");
  let empleado = ((await api("GET", "/api/employees")).datos ?? []).find((e) => e.name === quien.name);
  if (!empleado) {
    const creado = await api("POST", "/api/employees", { name: quien.name, role: quien.role, phone: quien.phone, roleId: rol.id });
    if (!creado.ok) throw new Error(`no se pudo crear el trabajador (${creado.estado})`);
    empleado = creado.datos;
  }
  const obras = ((await api("GET", "/api/projects")).datos ?? []).filter((p) => p.clientName === CLIENTE[idioma].name);
  const obra = obras.sort((a, b) => b.budgetTotal - a.budgetTotal)[0];
  if (!obra) throw new Error("no hay obra de la familia: graba antes la serie 1");
  for (const e of ((await api("GET", "/api/schedule-events")).datos ?? []).filter((e) => e.assignedWorkerId === empleado.id)) {
    await api("DELETE", `/api/schedule-events/${e.id}`);
  }
  const cita = await api("POST", "/api/schedule-events", {
    projectId: obra.id, title: quien.tarea, type: "visita",
    startTime: manana.hora(7), endTime: manana.hora(15, 30), assignedEmployeeId: empleado.id,
  });
  if (!cita.ok) throw new Error(`no se pudo programar su jornada (${cita.estado})`);
  let token = null;
  if (codigo) {
    token = (await api("POST", `/api/employees/${empleado.id}/access-token`)).datos?.token;
    if (!token) throw new Error("no se pudo generar el código del trabajador");
  }
  return { empleado, obra, token, citaId: cita.datos?.id };
}

/**
 * Fichar (o cerrar el fichaje abierto) como el trabajador, sin pasar por su
 * pantalla: para los vídeos que empiezan con él ya en la obra, y para no
 * dejar un fichaje abierto al terminar.
 */
export function fichajeDelTrabajador(pagina, token, gps) {
  const llamar = (ruta, cuerpo) =>
    pagina.evaluate(async ([r, t, c]) => {
      const res = await fetch(r, {
        method: c === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: c === undefined ? undefined : JSON.stringify(c),
      });
      return { ok: res.ok, estado: res.status, datos: await res.json().catch(() => null) };
    }, [ruta, token, cuerpo]);
  return {
    async entrar(projectId, scheduleEventId) {
      const r = await llamar("/api/worker/time-entries/check-in", { projectId, scheduleEventId, billable: true, ...gps });
      if (!r.ok) throw new Error(`no se pudo fichar la entrada (${r.estado})`);
    },
    async salir() {
      const abierto = await llamar("/api/worker/time-entries/active");
      if (abierto.datos?.id) await llamar(`/api/worker/time-entries/${abierto.datos.id}/check-out`, gps);
    },
  };
}

/**
 * Para el `despues` de cada guion: cambia los códigos del trabajador y del
 * cliente de la historia, que salen tecleados en pantalla. El que se ve en un
 * vídeo publicado deja de abrir nada en cuanto acaba la grabación. Y si el
 * trabajador quedó fichado, le cierra el fichaje con su código nuevo.
 */
export async function cambiarCodigos({ pagina, entrar, api }, idioma) {
  await pagina.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k !== "fsm-language") localStorage.removeItem(k);
  });
  await entrar();
  const empleado = ((await api("GET", "/api/employees")).datos ?? []).find((e) => e.name === TRABAJADOR[idioma].name);
  if (empleado) {
    const token = (await api("POST", `/api/employees/${empleado.id}/access-token`)).datos?.token;
    if (token) await fichajeDelTrabajador(pagina, token, TRABAJADOR[idioma].obra).salir();
  }
  const cliente = ((await api("GET", "/api/clients")).datos ?? []).find((c) => c.name === CLIENTE[idioma].name);
  // Sin correo, así que no le llega a nadie (ver CLIENTE).
  if (cliente && !cliente.email) await api("POST", `/api/clients/${cliente.id}/access-token`);
}
