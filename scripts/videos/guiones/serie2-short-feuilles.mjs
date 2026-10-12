/**
 * Serie 2, Short «las hojas de horas»: el gancho es el viernes reconstruyendo
 * horas de memoria; debajo, el trabajador ficha desde el móvil con el GPS.
 */
import { TRABAJADOR, trabajadorPreparado, cambiarCodigos } from "../demo.mjs";
import { MANANA, contextoDeObra, FINAL_SERIE2 } from "./serie2-comun.mjs";

const T = {
  fr: {
    gancho: { sobre: "Entrepreneurs", titulo: "Vendredi, les feuilles de temps. *Personne ne s'en souvient.*" },
    dia: "Votre gars voit sa journée sur son cellulaire.",
    ficha: "Il arrive, il choisit le chantier, il pointe. L'heure et la position GPS sont enregistrées.",
    cuenta: "Les heures régulières et supplémentaires se comptent toutes seules.",
    final: FINAL_SERIE2.fr,
    b: { entrar: "Entrer", pointage: "Pointage", llegada: "Pointer l'arrivée", turno: "Résumé du quart de travail" },
  },
};

T.it = {
  gancho: { sobre: "Imprese edili", titulo: "Venerdì, i fogli ore. *Nessuno se lo ricorda.*" },
  dia: "Il tuo operaio vede la sua giornata sul cellulare.",
  ficha: "Arriva, sceglie il cantiere e timbra. L'ora e la posizione GPS vengono registrate.",
  cuenta: "Le ore ordinarie e gli straordinari si contano da soli.",
  final: FINAL_SERIE2.it,
  b: { entrar: "Entra", pointage: "Timbratura", llegada: "Timbra entrata", turno: "Riepilogo del turno" },
};

export const youtube = {
  fr: {
    titulo: "Les feuilles de temps du vendredi ? Plus jamais #shorts",
    descripcion: `Votre travailleur voit sa journée sur son cellulaire, arrive sur le chantier et pointe : l'heure et la position GPS sont enregistrées, et les heures régulières et supplémentaires se comptent toutes seules.

▶ Le processus complet, de l'accès du travailleur aux heures pour la paie : sur la chaîne @LogicielConstruction.`,
    hashtags: ["shorts", "construction", "chantier"],
    etiquetas: ["feuille de temps", "pointage GPS", "heures travailleurs", "logiciel construction", "entrepreneur Québec"],
  },
};

youtube.it = {
  titulo: "I fogli ore del venerdì? Mai più #shorts",
  descripcion: `Il tuo operaio vede la sua giornata sul cellulare, arriva in cantiere e timbra: l'ora e la posizione GPS vengono registrate, e le ore ordinarie e gli straordinari si contano da soli.

▶ Il processo completo, dall'accesso dell'operaio alle ore per le paghe: sul canale @LogicielConstruction.`,
  hashtags: ["shorts", "edilizia", "cantiere"],
  etiquetas: ["foglio ore", "timbratura GPS", "presenze operai", "gestionale edilizia", "impresa edile"],
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  // Los códigos que salen tecleados en el vídeo dejan de valer al acabar.
  despues: (util) => cambiarCodigos(util, util.idioma),
  contexto: contextoDeObra,
  async pasos({ pagina, BASE, idioma, gancho, soltarGancho, tarjeta, resaltar, decir, callar, entrar, api, tocar, escribir, elegir, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    const quien = TRABAJADOR[idioma];
    await entrar();
    const { obra, token } = await trabajadorPreparado(api, idioma, MANANA);
    await pagina.goto(BASE + "/campo", { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: t.b.entrar }).waitFor({ timeout: 20_000 });

    await gancho({
      ...t.gancho,
      durante: async () => {
        await escribir(pagina.locator("input").first(), token, { rapido: true });
        await tocar(pagina.getByRole("button", { name: t.b.entrar }), 400);
        await pagina.getByText(quien.tarea).first().waitFor({ timeout: 20_000 });
      },
    });
    await soltarGancho();
    await resaltar(pagina.getByText(quien.tarea).first().locator("xpath=.."), 1600, t.dia, { arriba: true });
    await tocar(pagina.getByRole("tab", { name: t.b.pointage }), 700);
    await decir(t.ficha, 0, { arriba: true });
    await elegir(pagina.getByRole("combobox").first(), new RegExp(obra.name), 600);
    await tocar(pagina.getByRole("button", { name: t.b.llegada }), 2200);
    await resaltar(pagina.getByText(t.b.turno).first().locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]"), 2000, t.cuenta);
    await callar();
    await tarjeta({ ...t.final, ms: 5200 });
  },
};
