/**
 * Lo que comparten los vídeos de la serie 3 (captar clientes y tenerlos
 * informados): el prospecto que llega por el bot, cómo se le contesta, y la
 * tarjeta final de los Shorts.
 *
 * No es un guion (no tiene `pasos`): `--todos` lo salta.
 */

/**
 * La que escribe al bot. El correo es de example.com, que no se entrega
 * nunca, y en `despues` se le quita: si un día alguien le envía una
 * soumission, no tiene que salir nada.
 */
export const PROSPECTO = {
  fr: {
    servicio: "Cuisine",
    proyecto: "Refaire la cuisine au complet : armoires, comptoir en quartz et plancher.",
    direccion: "1250, rue des Érables, Laval",
    nombre: "Marie Gagnon",
    telefono: "514 555-0142",
    correo: "marie.gagnon@example.com",
  },
};

export const SERVICIOS = { fr: ["Cuisine", "Salle de bain", "Toiture"] };

/** Lo que pide el bot en cada paso, tal como sale en su campo. */
export const CAMPOS_DEL_BOT = {
  fr: {
    empezar: "Commencer",
    enviar: "Envoyer la demande",
    describir: "Écrivez ici une brève description du projet...",
    direccion: "Écrivez ici l'adresse du projet...",
    nombre: "Écrivez ici votre nom...",
    telefono: "Écrivez ici votre téléphone...",
    correo: "Écrivez ici votre adresse courriel...",
  },
};

/** El enlace público del negocio, sus servicios, y nada de grabaciones anteriores. */
export async function prepararCaptacion(api, idioma) {
  const empresa = await api("GET", "/api/settings/company");
  const slug = empresa.datos?.slug ?? empresa.datos?.business?.slug;
  if (!slug) throw new Error("no se encontró el enlace público del negocio");
  const categorias = (await api("GET", "/api/budget-categories")).datos ?? [];
  for (const nombre of SERVICIOS[idioma]) {
    if (!categorias.some((c) => c.name === nombre)) await api("POST", "/api/budget-categories", { name: nombre });
  }
  const nombre = PROSPECTO[idioma].nombre;
  for (const e of ((await api("GET", "/api/estimates")).datos ?? []).filter((e) => e.clientName === nombre)) await api("DELETE", `/api/estimates/${e.id}`);
  for (const c of ((await api("GET", "/api/clients")).datos ?? []).filter((c) => c.name === nombre)) await api("DELETE", `/api/clients/${c.id}`);
  return slug;
}

/** Contestar al bot como lo haría el cliente, paso a paso. */
export async function contestarAlBot({ pagina, tocar, escribir, decir }, idioma, frases = {}, { rapido = false } = {}) {
  const c = CAMPOS_DEL_BOT[idioma];
  const p = PROSPECTO[idioma];
  const arriba = { arriba: true };
  const responder = async (campo, texto, opciones) => {
    const entrada = pagina.getByPlaceholder(campo);
    await entrada.waitFor({ timeout: 15_000 });
    await escribir(entrada, texto, opciones);
    await tocar(pagina.locator('form button[type="submit"]'), rapido ? 700 : 1000);
  };
  await tocar(pagina.getByRole("button", { name: c.empezar }), rapido ? 900 : 1300);
  await pagina.getByRole("button", { name: p.servicio, exact: true }).waitFor({ timeout: 15_000 });
  if (frases.servicio) await decir(frases.servicio, 0, arriba);
  await tocar(pagina.getByRole("button", { name: p.servicio, exact: true }), rapido ? 900 : 1300);
  if (frases.describe) await decir(frases.describe, 0, arriba);
  await responder(c.describir, p.proyecto, { rapido });
  if (frases.datos) await decir(frases.datos, 0, arriba);
  await responder(c.direccion, p.direccion, { rapido: true });
  await responder(c.nombre, p.nombre, { rapido: true });
  await responder(c.telefono, p.telefono, { rapido: true });
  await responder(c.correo, p.correo, { rapido: true });
  const enviar = pagina.getByRole("button", { name: c.enviar });
  await enviar.waitFor({ timeout: 15_000 });
  if (frases.resumen) await decir(frases.resumen, 0, arriba);
  await tocar(enviar, 1500);
}

/** Para `despues`: el prospecto de mentira se queda sin correo. */
export async function quitarCorreoDelProspecto({ api }, idioma) {
  for (const c of ((await api("GET", "/api/clients")).datos ?? []).filter((c) => c.name === PROSPECTO[idioma].nombre)) {
    await api("PATCH", `/api/clients/${c.id}`, { email: "" });
  }
}

export const FINAL_SERIE3 = {
  fr: {
    sobre: "La vidéo complète est sur la chaîne",
    titulo: "Captez la demande, *gardez le client informé*.",
    texto: "Le lien qui répond pour vous, la demande dans votre logiciel, et le portail du client.",
    pie: "<b>Essai gratuit de 30 jours</b> · logiciel-construction.com",
  },
};
