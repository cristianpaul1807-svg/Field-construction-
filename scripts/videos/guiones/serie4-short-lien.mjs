/**
 * Serie 4, Short «el enlace»: el gancho es que un enlace pague cada mes;
 * debajo, el panel de ejemplo de quien ya lo comparte. Se graba en local:
 * ver serie4-comun.mjs.
 */
import { prepararGrabacion, abrirPanelDeEjemplo, etiquetas, tarjetaCon, FINAL_SERIE4 } from "./serie4-comun.mjs";

const T = {
  fr: {
    gancho: { sobre: "Vous connaissez des entrepreneurs ?", titulo: "Ce lien peut vous *payer chaque mois*." },
    ejemplo: "Exemple : un affilié avec quatre entreprises qui paient.",
    enlace: "Il partage son lien. Chaque entreprise qui s'abonne lui rapporte 30 % de ce qu'elle paie, pendant 12 mois.",
    clientes: "Et il voit qui est en essai, qui paie, et ce que chacune lui a rapporté.",
    cobro: "Dès 50 $, il retire : l'argent part sur son compte Stripe, puis à sa banque.",
    final: FINAL_SERIE4.fr,
  },
};

T.it = {
  gancho: { sobre: "Conosci delle imprese edili?", titulo: "Questo link può *pagarti ogni mese*." },
  ejemplo: "Esempio: un affiliato con quattro imprese che pagano.",
  enlace: "Condivide il suo link. Ogni impresa che si abbona gli porta il 30 % di quello che paga, per 12 mesi.",
  clientes: "E vede chi è in prova, chi paga, e quanto gli ha fatto guadagnare ognuna.",
  cobro: "Da 50 dollari preleva: i soldi vanno sul suo conto Stripe, e poi in banca.",
  final: FINAL_SERIE4.it,
};

export const youtube = {
  fr: {
    titulo: "Un lien qui vous paie chaque mois #shorts",
    descripcion: `Vous connaissez des entrepreneurs en construction ? Partagez votre lien : chaque entreprise qui s'abonne vous rapporte 30 % de ce qu'elle paie, pendant 12 mois. Paiement par Stripe dès 50 $. (Chiffres de l'exemple à titre indicatif.)

▶ Le programme complet, du contrat au paiement : sur la chaîne @LogicielConstruction.`,
    hashtags: ["shorts", "affiliation", "revenupassif"],
    etiquetas: ["programme d'affiliation", "revenu complémentaire", "gagner de l'argent", "commission récurrente", "entrepreneur Québec"],
  },
};

youtube.it = {
  titulo: "Un link che ti paga ogni mese #shorts",
  descripcion: `Conosci imprese edili? Condividi il tuo link: ogni impresa che si abbona ti porta il 30 % di quello che paga, per 12 mesi. Pagamento con Stripe da 50 dollari canadesi. (Cifre dell'esempio a titolo indicativo.)

▶ Il programma completo, dal contratto al pagamento: sul canale @LogicielConstruction.`,
  hashtags: ["shorts", "affiliazione", "guadagnareonline"],
  etiquetas: ["programma di affiliazione", "reddito extra", "guadagnare online", "commissioni ricorrenti", "imprese edili"],
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  paraAfiliados: true,
  contexto: () => ({ serviceWorkers: "block" }),
  async pasos(util) {
    const { pagina, idioma, gancho, soltarGancho, tarjeta, resaltar, decir, callar, pausa } = util;
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    const L = etiquetas(idioma);
    await prepararGrabacion(util);
    await abrirPanelDeEjemplo(util);
    const enlace = tarjetaCon(pagina, L.tuEnlace);
    await enlace.waitFor({ timeout: 30_000 });

    await gancho({ ...t.gancho, ms: 2400 });
    await soltarGancho();
    await decir(t.ejemplo, 0, { arriba: true });
    await resaltar(enlace, 2400, t.enlace);
    const clientes = tarjetaCon(pagina, L.tusClientes);
    await resaltar(clientes.locator("ul"), 2800, t.clientes, { arriba: true });
    await resaltar(tarjetaCon(pagina, L.cobroTitulo), 2400, t.cobro, { arriba: true });
    await callar();
    await pausa(200);
    await tarjeta({ ...t.final, ms: 5200 });
  },
};
