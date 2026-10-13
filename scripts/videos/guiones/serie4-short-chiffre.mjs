/**
 * Serie 4, Short «la cifra»: el gancho es lo que dan diez recomendaciones al
 * mes; debajo, la puerta del programa con la oferta y sus tres pasos. Se
 * graba en local: ver serie4-comun.mjs.
 *
 * La cuenta es la del plan más barato (Chantier, 99 al mes), sin impuestos:
 * la cifra que se promete en un gancho tiene que ser la que sale.
 */
import { prepararGrabacion, FINAL_SERIE4 } from "./serie4-comun.mjs";

const T = {
  fr: {
    gancho: { sobre: "Revenu complémentaire", titulo: "*297 $ par mois* en recommandant 10 entreprises." },
    cuenta: "Une entreprise au forfait Chantier paie 99 $ par mois. Vous en touchez 30 % : 29,70 $, chaque mois.",
    diez: "Dix entreprises, 297 $ par mois, pendant leurs 12 premiers mois. Taxes non comprises.",
    pasos: "Vous vous inscrivez, vous partagez votre lien, et vous êtes payé dès 50 $.",
    final: FINAL_SERIE4.fr,
  },
};

T.it = {
  gancho: { sobre: "Reddito extra", titulo: "*Circa 300 € al mese* consigliando 10 imprese." },
  cuenta: "Un'impresa con il piano Chantier paga 99 € al mese. A te ne arriva il 30 %: circa 30, ogni mese.",
  diez: "Dieci imprese, circa 300 al mese, per i loro primi 12 mesi. Tasse escluse.",
  pasos: "Ti iscrivi, condividi il tuo link, e vieni pagato da 50 dollari.",
  final: FINAL_SERIE4.it,
};

export const youtube = {
  fr: {
    titulo: "297 $ par mois en recommandant 10 entreprises #shorts",
    descripcion: `Une entreprise au forfait Chantier paie 99 $ par mois. Comme affilié, vous en touchez 30 % pendant ses 12 premiers mois : 29,70 $ par mois, par entreprise. Dix entreprises : 297 $ par mois. Taxes non comprises, paiement par Stripe dès 50 $.

▶ Le programme complet, du contrat au paiement : sur la chaîne @LogicielConstruction.`,
    hashtags: ["shorts", "affiliation", "revenucomplementaire"],
    etiquetas: ["programme d'affiliation", "revenu complémentaire", "revenu passif", "gagner de l'argent en ligne", "entrepreneur Québec"],
  },
};

youtube.it = {
  titulo: "Circa 300 € al mese consigliando 10 imprese #shorts",
  descripcion: `Un'impresa con il piano Chantier paga 99 € al mese. Come affiliato ricevi il 30 % per i suoi primi 12 mesi: circa 30 al mese per impresa. Dieci imprese: circa 300 al mese. Tasse escluse; pagamento con Stripe, in dollari canadesi, da 50 disponibili.

▶ Il programma completo, dal contratto al pagamento: sul canale @LogicielConstruction.`,
  hashtags: ["shorts", "affiliazione", "redditoextra"],
  etiquetas: ["programma di affiliazione", "reddito extra", "reddito passivo", "guadagnare online", "imprese edili"],
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  paraAfiliados: true,
  contexto: () => ({ serviceWorkers: "block" }),
  async pasos(util) {
    const { pagina, BASE, idioma, gancho, soltarGancho, tarjeta, resaltar, decir, callar, pausa } = util;
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    await prepararGrabacion(util);
    await pagina.goto(`${BASE}/afiliados?lang=${idioma}`, { waitUntil: "networkidle" });
    const titular = pagina.locator("header h1").first();
    await titular.waitFor({ timeout: 30_000 });

    await gancho({ ...t.gancho, ms: 2600 });
    await soltarGancho();
    await resaltar(titular, 2400, t.cuenta);
    await decir(t.diez, 2400);
    await resaltar(pagina.locator("header ol").first(), 2400, t.pasos);
    await callar();
    await pausa(200);
    await tarjeta({ ...t.final, ms: 5200 });
  },
};
