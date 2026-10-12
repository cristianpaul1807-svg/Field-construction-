/**
 * Serie 3, Short «21 h»: el gancho es el mensaje de la noche que nadie
 * contesta; debajo, el bot ya está tomando la demanda. Y por la mañana, en el
 * panel.
 */
import { PROSPECTO, prepararCaptacion, contestarAlBot, quitarCorreoDelProspecto, FINAL_SERIE3, CAMPOS_DEL_BOT } from "./serie3-comun.mjs";

const T = {
  fr: {
    gancho: { sobre: "Entrepreneurs", titulo: "Un client vous écrit à 21 h. *Vous êtes sur le chantier.*" },
    datos: "Votre lien lui répond : le type de travaux, son projet, ses coordonnées.",
    manana: { sobre: "Le lendemain matin", titulo: "Sa demande vous *attend*.", texto: "" },
    llega: "Prête à chiffrer, avec tout ce qu'il a écrit.",
    final: FINAL_SERIE3.fr,
  },
};

export const youtube = {
  fr: {
    titulo: "Un client vous écrit à 21 h et vous êtes sur le chantier ? #shorts",
    descripcion: `Votre lien public répond pour vous, même le soir : il pose les bonnes questions — type de travaux, projet, adresse, coordonnées — et le lendemain matin, la demande vous attend dans vos soumissions.

▶ Le processus complet, du lien public au portail client : sur la chaîne @LogicielConstruction.`,
    hashtags: ["shorts", "construction", "renovation"],
    etiquetas: ["demande de soumission", "trouver des clients construction", "chatbot entrepreneur", "logiciel construction", "rénovation Québec"],
  },
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  despues: (util) => quitarCorreoDelProspecto(util, util.idioma),
  async pasos(util) {
    const { pagina, BASE, idioma, gancho, soltarGancho, tarjeta, resaltar, decir, callar, entrar, navegar, api, pausa } = util;
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    await entrar();
    const slug = await prepararCaptacion(api, idioma);
    await pagina.goto(`${BASE}/c/${slug}`, { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: CAMPOS_DEL_BOT[idioma].empezar }).waitFor({ timeout: 20_000 });

    await gancho({ ...t.gancho, ms: 2400 });
    await soltarGancho();
    await contestarAlBot(util, idioma, { servicio: t.datos }, { rapido: true });
    await callar();
    const nueva = pagina.locator("button").filter({ hasText: PROSPECTO[idioma].nombre }).first();
    await tarjeta({ ...t.manana, ms: 2600, durante: () => navegar("/budgets", nueva) });
    await resaltar(nueva, 2000, t.llega, { arriba: true });
    await callar();
    await tarjeta({ ...t.final, ms: 5200 });
  },
};
