/**
 * Serie 3, el vídeo largo: captar al cliente y tenerlo informado.
 *
 * El enlace público del negocio, el bot que toma la demanda a las nueve de la
 * noche, la demanda esperando en el panel y en el CRM, y el portal donde el
 * cliente que ya firmó sigue su obra sin llamar.
 */
import { asegurarCliente, borrarPresupuestosDe, cambiarCodigos } from "../demo.mjs";
import { PROSPECTO, prepararCaptacion, contestarAlBot, quitarCorreoDelProspecto } from "./serie3-comun.mjs";

const T = {
  fr: {
    problema: { sobre: "Le problème", titulo: "Un client vous écrit à 21 h. *Vous êtes sur le chantier.*", texto: "Le temps de rappeler, il a signé ailleurs. Et ceux qui signent appellent dix fois pour savoir où ça en est." },
    plan: { sobre: "Dans cette vidéo", titulo: "Captez la demande, *gardez le client informé*.", texto: "Le lien qui répond pour vous, la demande dans votre logiciel, et le portail où le client suit son chantier." },
    caps: ["Le problème", "1. Votre lien public", "2. Le client fait sa demande", "3. La demande dans votre logiciel", "4. Le portail : le client suit son chantier", "Le résultat"],
    enlace: "Votre lien est ici. Il ne change jamais : mettez-le sur votre site, votre page Facebook ou votre fiche Google.",
    mensaje: "Et ce message est prêt à coller comme message d'accueil de WhatsApp Business.",
    cliente: { sobre: "Côté client, 21 h", titulo: "Il clique sur votre lien. *Un assistant lui répond.*", texto: "Pas de formulaire à remplir : des questions simples, une à la fois." },
    servicio: "Il choisit le type de travaux, parmi vos propres services.",
    describe: "Il décrit son projet avec ses mots.",
    datos: "Puis l'adresse, son nom, son téléphone et son courriel.",
    resumen: "Il relit le résumé, et il envoie.",
    listo: "C'est fait. Il peut même demander un rendez-vous.",
    manana: { sobre: "Le lendemain matin", titulo: "La demande vous *attend*.", texto: "Dans vos soumissions, et dans votre CRM." },
    llega: "La demande est là, en premier, marquée comme reçue par clavardage.",
    abre: "Ses coordonnées et son projet sont déjà remplis. Il ne reste qu'à mettre vos prix.",
    crm: "Et elle est dans votre CRM comme nouveau prospect, avec d'où elle vient : votre lien public.",
    portal: { sobre: "Une fois la soumission signée", titulo: "Le client suit son chantier *sans vous appeler*.", texto: "Dans son portail, avec un simple code." },
    codigo: "Il entre avec son code. Rien à installer, pas de mot de passe.",
    etapas: "Il voit où en est son chantier, étape par étape. Chaque étape se coche toute seule quand elle arrive vraiment.",
    pagos: "Il sait ce qu'il aura à payer, et à quel moment des travaux.",
    mensajes: "Et s'il a une question, il l'écrit ici. Tout reste par écrit, au même endroit.",
    resultado: { sobre: "Le résultat", titulo: "Plus de demandes perdues, *moins d'appels*.", texto: "Et un client rassuré, c'est un client qui vous recommande." },
    cierre: { titulo: "Logiciel Construction", texto: "Abonnez-vous : chaque vidéo explique un processus de votre entreprise, du début à la fin.", pie: "<b>Essai gratuit de 30 jours</b> · logiciel-construction.com" },
    mensajeCliente: "Bonjour ! Est-ce que l'équipe arrive à 7 h demain matin ?",
    b: { enlace: "Votre lien", sugerido: "Texte suggéré pour votre message d'accueil", empezar: "Commencer", etapas: "Les étapes de votre chantier", pagos: "Échéancier de paiement", mensajes: "Messages", escribir: "Écrivez un message..." },
  },
};

export const youtube = {
  fr: {
    titulo: "Trouver des clients en construction et les garder informés : lien public, CRM et portail client",
    descripcion: `Le processus complet pour ne plus perdre de demandes de soumission : un lien public à mettre sur votre site, votre page Facebook ou votre fiche Google, un assistant qui pose les bonnes questions même à 21 h, la demande qui vous attend le lendemain dans vos soumissions et votre CRM, et un portail où le client suit son chantier, ses paiements et vous écrit — sans vous appeler.

Pour les entrepreneurs en construction et en rénovation au Québec.`,
    hashtags: ["construction", "renovation", "entrepreneur"],
    etiquetas: ["trouver des clients construction", "demande de soumission", "CRM construction", "portail client", "suivi de chantier", "chatbot entrepreneur", "entrepreneur en rénovation", "logiciel construction", "rénovation Québec"],
  },
};

export default {
  formato: "horizontal",
  textos: T,
  youtube,
  despues: async (util) => {
    await cambiarCodigos(util, util.idioma);
    await quitarCorreoDelProspecto(util, util.idioma);
  },
  async pasos(util) {
    const { pagina, BASE, idioma, tarjeta, capitulo, resaltar, decir, callar, entrar, navegar, api, tocar, escribir, pausa } = util;
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    const p = PROSPECTO[idioma];
    await entrar();
    const slug = await prepararCaptacion(api, idioma);
    // Que el portal enseñe la soumission firmada, no un borrador de una
    // grabación anterior.
    await borrarPresupuestosDe(api, idioma);
    await pagina.goto(BASE + "/settings/whatsapp", { waitUntil: "networkidle" });
    await pagina.getByLabel(t.b.enlace).first().waitFor({ timeout: 20_000 });

    await tarjeta({ ...t.problema, tipo: "problema", ms: 5400, capitulo: t.caps[0] });
    await tarjeta({ ...t.plan, ms: 4800 });

    // 1. El enlace
    capitulo(t.caps[1]);
    // Las dos tarjetas de la pantalla: la del enlace (su campo sólo lleva la
    // etiqueta para lectores de pantalla) y la del mensaje sugerido.
    const tarjetaCon = (algo) => pagina.locator('[data-slot="card"]').filter({ has: algo }).first();
    await resaltar(tarjetaCon(pagina.getByLabel(t.b.enlace)), 2800, t.enlace);
    await resaltar(tarjetaCon(pagina.getByText(t.b.sugerido)), 2400, t.mensaje);

    // 2. El bot
    await tarjeta({ ...t.cliente, ms: 4600, capitulo: t.caps[2], durante: () => navegar(`/c/${slug}`, pagina.getByRole("button", { name: t.b.empezar })) });
    await contestarAlBot(util, idioma, { servicio: t.servicio, describe: t.describe, datos: t.datos, resumen: t.resumen });
    await decir(t.listo, 2200, { arriba: true });
    await callar();

    // 3. En el panel
    const nueva = pagina.locator("button").filter({ hasText: p.nombre }).first();
    await tarjeta({ ...t.manana, ms: 3600, capitulo: t.caps[3], durante: () => navegar("/budgets", nueva) });
    await resaltar(nueva, 2400, t.llega);
    await tocar(nueva, 1200);
    await resaltar(pagina.locator("h2").filter({ hasText: /EST-|n°/ }).first().locator("xpath=../.."), 2800, t.abre);
    await navegar("/crm", pagina.locator("tr").filter({ hasText: p.nombre }).first());
    await pausa(800);
    await resaltar(pagina.locator("tr").filter({ hasText: p.nombre }).first(), 2800, t.crm);
    await callar();

    // 4. El portal de la familia, que ya firmó.
    const clienteId = await asegurarCliente(api, idioma);
    const acceso = await api("POST", `/api/clients/${clienteId}/access-token`);
    if (!acceso.ok) throw new Error(`no se pudo generar el código del cliente (${acceso.estado})`);
    await tarjeta({
      ...t.portal, ms: 4400, capitulo: t.caps[4],
      durante: async () => {
        await pagina.evaluate(() => {
          for (const k of Object.keys(localStorage)) if (k !== "fsm-language") localStorage.removeItem(k);
        });
        await pagina.goto(BASE + "/cliente/acceso", { waitUntil: "networkidle" });
      },
    });
    await decir(t.codigo, 0);
    await escribir("#client-token", acceso.datos.token);
    await tocar('button[type="submit"]', 600);
    const etapas = pagina.getByText(t.b.etapas).first();
    await etapas.waitFor({ timeout: 20_000 });
    await pausa(900);
    await resaltar(etapas.locator("xpath=ancestor::div[contains(@class,'rounded')][1]"), 2800, t.etapas);
    await resaltar(pagina.getByText(t.b.pagos).first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]"), 2400, t.pagos);
    await tocar(pagina.getByRole("tab", { name: t.b.mensajes }), 1000);
    await tocar(pagina.locator("button.w-full.text-left").first(), 1000);
    await decir(t.mensajes, 0);
    await escribir(pagina.getByPlaceholder(t.b.escribir), t.mensajeCliente);
    await tocar(pagina.locator('form button[type="submit"]').last(), 1800);
    await callar();

    await tarjeta({ ...t.resultado, tipo: "resultado", ms: 5200, capitulo: t.caps[5] });
    await tarjeta({ ...t.cierre, ms: 5600 });
  },
};
