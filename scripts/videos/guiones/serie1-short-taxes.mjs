/**
 * Serie 1, Short «las taxes»: el gancho es la calculadora; debajo, la marge
 * moviéndose y los totales con TPS y TVQ rehaciéndose solos.
 */
import { borrarPresupuestosDe, soumissionPreparada } from "../demo.mjs";
import { FINAL_SERIE1 } from "./serie1-comun.mjs";

const T = {
  fr: {
    gancho: { sobre: "Entrepreneurs", titulo: "TPS, TVQ, marge, pertes… *sans calculatrice.*" },
    margen: "Vous montez la marge…",
    perdidas: "…vous ajoutez les pertes pour les coupes…",
    totales: "…et le total, la TPS et la TVQ se refont tout seuls. Le client ne voit que le prix final.",
    final: FINAL_SERIE1.fr,
    b: { taxes: /TVQ/, numero: "EST-" },
  },
};

export const youtube = {
  fr: {
    titulo: "TPS, TVQ, marge et pertes sans calculatrice #shorts",
    descripcion: `Dans une soumission de rénovation, la marge et le facteur de pertes sont intégrés au prix, et la TPS (5 %) et la TVQ (9,975 %) se calculent toutes seules sur la valeur complète des travaux.

▶ Le processus complet, de la soumission au chantier : sur la chaîne @LogicielConstruction.`,
    hashtags: ["shorts", "construction", "entrepreneur"],
    etiquetas: ["TPS TVQ", "calcul taxes construction", "marge entrepreneur", "soumission construction", "logiciel construction"],
  },
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  async pasos({ pagina, BASE, idioma, gancho, soltarGancho, tarjeta, resaltar, decir, callar, entrar, api, tocar, deslizar, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    // Una soumission en borrador, sin marge ni pertes todavía: eso es lo que
    // se mueve delante de la cámara.
    await entrar();
    await borrarPresupuestosDe(api, idioma);
    const id = await soumissionPreparada(api, idioma, { margen: 0, perdidas: 0 });
    const numero = ((await api("GET", "/api/estimates")).datos ?? []).find((e) => e.id === id)?.number;
    await pagina.goto(BASE + "/budgets", { waitUntil: "networkidle" });
    // La suya, abierta: la primera del carrusel puede ser otra.
    await pagina.locator("button").filter({ hasText: numero ?? t.b.numero }).first().click();
    const reglas = pagina.locator('input[type="range"]');
    await reglas.first().evaluate((e) => e.scrollIntoView({ block: "center" }));
    await pausa(800);

    await gancho({ ...t.gancho, ms: 2600 });
    await soltarGancho();
    await decir(t.margen, 0, { arriba: true });
    await deslizar(reglas.nth(0), 18);
    await decir(t.perdidas, 0, { arriba: true });
    await deslizar(reglas.nth(1), 6);
    const totales = pagina.getByText(t.b.taxes).first().locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    await resaltar(totales, 2600, t.totales, { arriba: true });
    await callar();
    await tarjeta({ ...t.final, ms: 5200 });
  },
};
