/**
 * El enlace de captación: un cliente pide su soumission al bot a cualquier
 * hora, y a la mañana siguiente está esperando en el panel. En vertical,
 * porque así es como llega quien pulsa el enlace desde Facebook o Google.
 *
 * El chat público es el de verdad y deja un cliente y una soumission de
 * verdad en la cuenta de pruebas. Terminar el chat no envía ningún correo
 * (sólo se envía al mandar la soumission), y aun así la dirección es de
 * example.com, que no se entrega nunca: nadie recibe nada por este vídeo.
 */

const T = {
  fr: {
    problema: { sobre: "Le problème", titulo: "Un client vous écrit à 21\u00a0h. *Vous êtes sur le chantier.*", texto: "Le temps de rappeler, il a signé avec quelqu'un d'autre." },
    idea: { sobre: "La solution", titulo: "Un lien qui *répond pour vous*, jour et nuit.", texto: "Sur votre site, votre page Facebook ou votre fiche Google." },
    lado: "Voici ce que voit votre futur client.",
    servicio: "Il choisit le type de travaux, parmi vos propres services.",
    describe: "Il explique son projet avec ses mots.",
    datos: "Puis l'adresse, son nom, son téléphone et son courriel.",
    resumen: "Il relit le résumé et l'envoie.",
    listo: "C'est fait. Il n'a eu besoin de personne.",
    manana: { sobre: "Le lendemain matin", titulo: "Vous ouvrez votre *logiciel*.", texto: "" },
    llega: "La demande est là, en premier, marquée comme reçue par clavardage.",
    abre: "Ses coordonnées et son projet sont déjà remplis. Il ne reste qu'à mettre vos prix.",
    resultado: { sobre: "Le résultat", titulo: "Plus aucun client perdu *parce que vous étiez occupé*.", texto: "Le prospect est dans votre CRM, et sa soumission vous attend." },
    cierre: { titulo: "Logiciel Construction", texto: "Vos demandes de soumission prises en note, même la nuit.", pie: "<b>Essai gratuit de 30 jours</b> · logiciel-construction.com" },
    datosCliente: {
      servicio: "Cuisine",
      proyecto: "Refaire la cuisine au complet : armoires, comptoir en quartz et plancher.",
      direccion: "1250, rue des Érables, Laval",
      nombre: "Marie Gagnon",
      telefono: "514 555-0142",
      correo: "marie.gagnon@example.com",
    },
    servicios: ["Cuisine", "Salle de bain", "Toiture"],
    b: {
      empezar: "Commencer",
      enviar: "Envoyer la demande",
      describir: "Écrivez ici une brève description du projet...",
      direccion: "Écrivez ici l'adresse du projet...",
      nombre: "Écrivez ici votre nom...",
      telefono: "Écrivez ici votre téléphone...",
      correo: "Écrivez ici votre adresse courriel...",
    },
  },
};

export const youtube = {
  fr: {
    titulo: "Recevoir des demandes de soumission 24 h sur 24 sans répondre au téléphone #shorts",
    descripcion: `Un client vous écrit le soir, vous êtes sur le chantier, et le temps de rappeler il a signé ailleurs. Avec un simple lien sur votre site ou votre page Facebook, un assistant lui pose les bonnes questions — type de travaux, projet, adresse, coordonnées — et le lendemain matin, sa demande vous attend, prête à chiffrer.

Pour les entrepreneurs en construction et en rénovation au Québec.`,
    hashtags: ["construction", "renovation", "shorts"],
    etiquetas: ["demande de soumission", "trouver des clients construction", "entrepreneur en rénovation", "prospects construction", "chatbot entrepreneur", "logiciel construction", "rénovation Québec", "soumission en ligne"],
  },
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  async pasos({ pagina, idioma, tarjeta, resaltar, decir, callar, navegar, entrar, api, tocar, escribir, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    const d = t.datosCliente;

    // Fuera de cámara: la sesión del negocio (para el final, en el panel), sus
    // servicios, y nada de las grabaciones anteriores.
    await entrar();
    const empresa = await api("GET", "/api/settings/company");
    const slug = empresa.datos?.slug ?? empresa.datos?.business?.slug;
    if (!slug) throw new Error("no se encontró el enlace público del negocio");
    const categorias = await api("GET", "/api/budget-categories");
    for (const nombre of t.servicios) {
      if (!(categorias.datos ?? []).some((c) => c.name === nombre)) await api("POST", "/api/budget-categories", { name: nombre });
    }
    const presupuestos = await api("GET", "/api/estimates");
    for (const e of (presupuestos.datos ?? []).filter((e) => e.clientName === d.nombre)) await api("DELETE", `/api/estimates/${e.id}`);
    const clientes = await api("GET", "/api/clients");
    for (const c of (clientes.datos ?? []).filter((c) => c.name === d.nombre)) await api("DELETE", `/api/clients/${c.id}`);

    await tarjeta({ ...t.problema, tipo: "problema", ms: 5200, capitulo: t.problema.sobre });
    // El chat se abre detrás de la tarjeta: cuando se va, ya está.
    await tarjeta({ ...t.idea, ms: 4600, durante: () => navegar(`/c/${slug}`, pagina.getByRole("button", { name: t.b.empezar })) });
    // Abajo, encima del botón: arriba tapaba el saludo del asistente, que es
    // lo primero que tiene que leerse.
    await decir(t.lado, 1800);
    await tocar(pagina.getByRole("button", { name: t.b.empezar }), 1400);

    await pagina.getByRole("button", { name: d.servicio, exact: true }).waitFor({ timeout: 15_000 });
    await decir(t.servicio, 0, { arriba: true });
    await pausa(1200);
    await tocar(pagina.getByRole("button", { name: d.servicio, exact: true }), 1400);

    // Cada respuesta: escribirla y esperar a que el bot haga la pregunta
    // siguiente, que es cuando aparece su campo.
    const responder = async (campo, texto, opciones) => {
      const entrada = pagina.getByPlaceholder(campo);
      await entrada.waitFor({ timeout: 15_000 });
      await escribir(entrada, texto, opciones);
      await tocar(pagina.locator('form button[type="submit"]'), 1100);
    };
    await decir(t.describe, 0, { arriba: true });
    await responder(t.b.describir, d.proyecto);
    await decir(t.datos, 0, { arriba: true });
    await responder(t.b.direccion, d.direccion, { rapido: true });
    await responder(t.b.nombre, d.nombre, { rapido: true });
    await responder(t.b.telefono, d.telefono, { rapido: true });
    await responder(t.b.correo, d.correo, { rapido: true });

    const enviar = pagina.getByRole("button", { name: t.b.enviar });
    await enviar.waitFor({ timeout: 15_000 });
    await decir(t.resumen, 0, { arriba: true });
    await pausa(1500);
    await tocar(enviar, 1600);
    await decir(t.listo, 2400, { arriba: true });
    await callar();

    const nueva = pagina.locator("button").filter({ hasText: d.nombre }).first();
    await tarjeta({ ...t.manana, ms: 3000, capitulo: t.manana.sobre, durante: () => navegar("/budgets", nueva) });
    await resaltar(nueva, 2600, t.llega);
    await tocar(nueva, 1200);
    // El encabezado de la soumission abierta: nombre, teléfono, correo y lo
    // que escribió el cliente.
    const cabecera = pagina.locator("h2").filter({ hasText: /EST-|n°/ }).first().locator("xpath=../..");
    await resaltar(cabecera, 3000, t.abre);

    await tarjeta({ ...t.resultado, tipo: "resultado", ms: 5000, capitulo: t.resultado.sobre });
    await tarjeta({ ...t.cierre, ms: 4800 });

    // Que el correo de mentira no se quede en la cuenta: si un día alguien le
    // envía la soumission a este prospecto, no tiene que salir nada.
    const despues = await api("GET", "/api/clients");
    for (const c of (despues.datos ?? []).filter((c) => c.name === d.nombre)) await api("PATCH", `/api/clients/${c.id}`, { email: "" });
  },
};
