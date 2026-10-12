/**
 * Serie 2, Short «¿dónde están?»: el gancho es la pregunta del lunes a las 7;
 * debajo, el mapa del panel en el móvil del dueño con su trabajador en la obra.
 */
import { TRABAJADOR, trabajadorPreparado, fichajeDelTrabajador, cambiarCodigos } from "../demo.mjs";
import { MANANA, contextoDeObra, FINAL_SERIE2 } from "./serie2-comun.mjs";

const T = {
  fr: {
    gancho: { sobre: "Entrepreneurs", titulo: "Lundi, 7 h. *Où sont mes gars ?*" },
    mapa: "Ils apparaissent sur la carte dès qu'ils pointent, à l'adresse du chantier.",
    activos: "Qui est sur place, et sur quel chantier. Sans appeler personne.",
    final: FINAL_SERIE2.fr,
    b: { activos: "Actifs maintenant" },
  },
};

T.it = {
  gancho: { sobre: "Imprese edili", titulo: "Lunedì, ore 7. *Dove sono i miei operai?*" },
  mapa: "Compaiono sulla mappa appena timbrano, nel punto del cantiere.",
  activos: "Chi è sul posto, e in quale cantiere. Senza chiamare nessuno.",
  final: FINAL_SERIE2.it,
  b: { activos: "Attivi ora" },
};

export const youtube = {
  fr: {
    titulo: "Lundi 7 h : où sont mes gars ? #shorts",
    descripcion: `Dès qu'un travailleur pointe sur le chantier depuis son cellulaire, il apparaît sur la carte au bureau, avec le chantier où il est. Plus besoin d'appeler pour savoir qui est où.

▶ Le processus complet, de l'accès du travailleur aux heures pour la paie : sur la chaîne @LogicielConstruction.`,
    hashtags: ["shorts", "construction", "chantier"],
    etiquetas: ["localisation employés", "pointage GPS", "gestion d'équipe chantier", "logiciel construction", "entrepreneur Québec"],
  },
};

youtube.it = {
  titulo: "Lunedì ore 7: dove sono i miei operai? #shorts",
  descripcion: `Appena un operaio timbra in cantiere dal cellulare, compare sulla mappa in ufficio, con il cantiere in cui si trova. Non serve più chiamare per sapere chi è dove.

▶ Il processo completo, dall'accesso dell'operaio alle ore per le paghe: sul canale @LogicielConstruction.`,
  hashtags: ["shorts", "edilizia", "cantiere"],
  etiquetas: ["localizzazione operai", "timbratura GPS", "gestione squadra cantiere", "gestionale edilizia", "impresa edile"],
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  // Los códigos que salen tecleados en el vídeo dejan de valer al acabar.
  despues: (util) => cambiarCodigos(util, util.idioma),
  contexto: contextoDeObra,
  async pasos({ pagina, BASE, idioma, gancho, soltarGancho, tarjeta, resaltar, callar, entrar, api, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    const quien = TRABAJADOR[idioma];
    // Fuera de cámara: el trabajador ya fichó en la obra.
    await entrar();
    const { obra, token, citaId } = await trabajadorPreparado(api, idioma, MANANA);
    const fichaje = fichajeDelTrabajador(pagina, token, quien.obra);
    await fichaje.salir();
    await fichaje.entrar(obra.id, citaId);
    await pagina.goto(BASE + "/gps-routing", { waitUntil: "networkidle" });
    const marcador = pagina.getByText(quien.name).first();
    await marcador.waitFor({ timeout: 20_000 });
    await pausa(1200);

    const mapa = pagina.locator("div.touch-none").filter({ has: marcador }).first();
    await gancho({ ...t.gancho, ms: 2600 });
    await soltarGancho();
    await resaltar(mapa, 2200, t.mapa, { arriba: true });
    await resaltar(pagina.getByText(t.b.activos).first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]"), 2200, t.activos, { arriba: true });
    await callar();
    await tarjeta({ ...t.final, ms: 5200 });
  },
};
