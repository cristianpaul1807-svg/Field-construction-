/**
 * Serie 2, Short «sin app»: el gancho es la app que nadie descarga; debajo,
 * el trabajador entra con un código y ya está en su jornada.
 */
import { TRABAJADOR, trabajadorPreparado, cambiarCodigos } from "../demo.mjs";
import { MANANA, contextoDeObra, FINAL_SERIE2 } from "./serie2-comun.mjs";

const T = {
  fr: {
    gancho: { sobre: "Entrepreneurs", titulo: "Une app à télécharger ? *Vos gars ne le feront pas.*" },
    codigo: "Ici, un code. Pas de boutique, pas de compte, pas de mot de passe.",
    dia: "Et il est dans sa journée : le chantier, l'heure, quoi faire.",
    pestanas: "Son horaire, son pointage et vos messages. Rien d'autre à apprendre.",
    final: FINAL_SERIE2.fr,
    b: { entrar: "Entrer" },
  },
};

export const youtube = {
  fr: {
    titulo: "Une app que vos gars vont vraiment utiliser #shorts",
    descripcion: `Pas de boutique d'applications, pas de compte, pas de mot de passe : votre travailleur entre avec un code et voit tout de suite sa journée, son pointage et vos messages.

▶ Le processus complet, de l'accès du travailleur aux heures pour la paie : sur la chaîne @LogicielConstruction.`,
    hashtags: ["shorts", "construction", "entrepreneur"],
    etiquetas: ["application chantier", "application employés construction", "logiciel construction", "entrepreneur Québec"],
  },
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  // Los códigos que salen tecleados en el vídeo dejan de valer al acabar.
  despues: (util) => cambiarCodigos(util, util.idioma),
  contexto: contextoDeObra,
  async pasos({ pagina, BASE, idioma, gancho, soltarGancho, tarjeta, resaltar, decir, callar, entrar, api, tocar, escribir, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    const quien = TRABAJADOR[idioma];
    await entrar();
    const { token } = await trabajadorPreparado(api, idioma, MANANA);
    await pagina.goto(BASE + "/campo", { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: t.b.entrar }).waitFor({ timeout: 20_000 });

    await gancho({ ...t.gancho, ms: 2400 });
    await soltarGancho();
    await decir(t.codigo, 0, { arriba: true });
    await escribir(pagina.locator("input").first(), token);
    await tocar(pagina.getByRole("button", { name: t.b.entrar }), 600);
    const bloque = pagina.getByText(quien.tarea).first();
    await bloque.waitFor({ timeout: 20_000 });
    await pausa(900);
    await resaltar(bloque.locator("xpath=.."), 1800, t.dia, { arriba: true });
    await resaltar(pagina.getByRole("tablist").first(), 1800, t.pestanas, { arriba: true });
    await callar();
    await tarjeta({ ...t.final, ms: 5200 });
  },
};
