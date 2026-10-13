/**
 * Serie 4, Short «las reglas»: el gancho es la desconfianza de quien ya ha
 * visto programas de afiliados con letra pequeña; debajo, el contrato que se
 * firma antes de recibir el enlace, punto por punto. Se graba en local: ver
 * serie4-comun.mjs. El formulario se rellena y se firma, pero no se envía.
 */
import { prepararGrabacion, etiquetas, ALTA, firmarConElDedo, FINAL_SERIE4 } from "./serie4-comun.mjs";

const T = {
  fr: {
    gancho: { sobre: "Programme d'affiliation", titulo: "Les règles, *sans petits caractères*." },
    cuanto: "30 % de ce que paie chaque entreprise que vous amenez, pendant 12 mois.",
    espera: "Chaque commission attend 30 jours. Un remboursement l'annule.",
    prohibido: "Interdit : le pourriel, les fausses promesses, et votre propre entreprise.",
    firma: "Vous signez, et votre lien est prêt.",
    final: FINAL_SERIE4.fr,
  },
};

T.it = {
  gancho: { sobre: "Programma di affiliazione", titulo: "Le regole, *senza clausole nascoste*." },
  cuanto: "Il 30 % di quello che paga ogni impresa che porti, per 12 mesi.",
  espera: "Ogni commissione aspetta 30 giorni. Un rimborso la annulla.",
  prohibido: "Vietati: lo spam, le false promesse, e la tua stessa impresa.",
  firma: "Firmi, e il tuo link è pronto.",
  final: FINAL_SERIE4.it,
};

export const youtube = {
  fr: {
    titulo: "Un programme d'affiliation sans petits caractères #shorts",
    descripcion: `Avant de recevoir votre lien, vous signez un contrat clair : 30 % de ce que paie chaque entreprise que vous amenez pendant 12 mois, 30 jours d'attente par commission, paiement par Stripe dès 50 $, et ce qui est interdit.

▶ Le programme complet, du contrat au paiement : sur la chaîne @LogicielConstruction.`,
    hashtags: ["shorts", "affiliation", "marketingdaffiliation"],
    etiquetas: ["programme d'affiliation", "contrat d'affiliation", "revenu complémentaire", "marketing d'affiliation", "entrepreneur Québec"],
  },
};

youtube.it = {
  titulo: "Un programma di affiliazione senza clausole nascoste #shorts",
  descripcion: `Prima di ricevere il link firmi un contratto chiaro: il 30 % di quello che paga ogni impresa che porti per 12 mesi, 30 giorni di attesa per commissione, pagamento con Stripe da 50 dollari canadesi, e cosa è vietato.

▶ Il programma completo, dal contratto al pagamento: sul canale @LogicielConstruction.`,
  hashtags: ["shorts", "affiliazione", "affiliatemarketing"],
  etiquetas: ["programma di affiliazione", "contratto di affiliazione", "reddito extra", "affiliate marketing", "imprese edili"],
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  paraAfiliados: true,
  contexto: () => ({ serviceWorkers: "block" }),
  async pasos(util) {
    const { pagina, BASE, idioma, gancho, soltarGancho, tarjeta, resaltar, decir, callar, escribir, tocar, pausa } = util;
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    const L = etiquetas(idioma);
    await prepararGrabacion(util);
    await pagina.goto(`${BASE}/afiliados?lang=${idioma}`, { waitUntil: "networkidle" });
    const contrato = pagina.locator("h3").filter({ hasText: L.contratoTitulo }).locator("xpath=..");
    await contrato.waitFor({ timeout: 30_000 });
    // Empieza ya en el contrato: lo de arriba (correo, contraseña) no es lo
    // que cuenta este Short.
    await contrato.evaluate((e) => e.scrollIntoView({ block: "start" }));
    await pausa(300);

    await gancho({ ...t.gancho, ms: 2400 });
    await soltarGancho();
    const puntos = contrato.locator("li");
    await resaltar(puntos.nth(0), 2000, t.cuanto);
    await resaltar(puntos.nth(2), 2000, t.espera);
    await resaltar(puntos.nth(4), 2000, t.prohibido);
    await decir(t.firma, 0);
    await escribir(pagina.locator("#afiliado-firma"), ALTA[idioma].firma);
    await firmarConElDedo(pagina, contrato.locator("canvas"), pausa);
    await tocar(pagina.locator("#afiliado-acepta"), 900);
    await callar();
    await tarjeta({ ...t.final, ms: 5200 });
  },
};
