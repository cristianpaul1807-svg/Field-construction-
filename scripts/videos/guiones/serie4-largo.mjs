/**
 * Serie 4, el vídeo largo: el programa de afiliados, de la puerta al banco.
 *
 * No le habla al contratista sino a quien lo conoce. Le enseña la oferta tal
 * como está en el sitio, el alta con el contrato firmado (rellenada, no
 * enviada), un panel de ejemplo —dicho como ejemplo— y cómo llega el dinero.
 * Se graba en local: ver serie4-comun.mjs.
 */
import { prepararGrabacion, conSesion, ALTA, firmarConElDedo, etiquetas, tarjetaCon as tarjetaDelPanel } from "./serie4-comun.mjs";

const T = {
  fr: {
    problema: {
      sobre: "Vous connaissez des entrepreneurs ?",
      titulo: "Ils paient leurs outils chaque mois. *Vous pourriez en toucher 30 %.*",
      texto: "Si vous parlez à des entrepreneurs en construction, sur YouTube, au travail ou dans vos groupes, cette vidéo est pour vous.",
    },
    plan: {
      sobre: "Dans cette vidéo",
      titulo: "Le programme d'affiliation, *de l'inscription au paiement*.",
      texto: "L'offre, le contrat que vous signez, votre lien, votre panneau, et comment l'argent arrive à votre banque.",
    },
    caps: ["L'idée", "1. L'offre", "2. L'inscription et le contrat", "3. Votre lien et votre panneau", "4. Comment vous êtes payé", "Les règles"],
    franja: "Sur chaque page de notre site, il y a cette porte : devenir affilié.",
    oferta: "L'offre est simple : 30 % de ce que paie chaque entreprise que vous amenez, pendant ses 12 premiers mois.",
    pasos: "Trois étapes : vous vous inscrivez, vous partagez votre lien, et vous êtes payé dès 50 $.",
    ejemplo: {
      sobre: "Un exemple",
      cifra: "297 $",
      titulo: "par mois, pour *10 entreprises* au forfait Chantier.",
      texto: "Soit 297 $ par mois : 30 % de 99 $ pour chacune, pendant ses 12 premiers mois. Taxes non comprises.",
    },
    cuenta: "Pour s'inscrire : un courriel et un mot de passe.",
    donde: "Puis votre nom, et où vous allez partager votre lien.",
    contrato: "Ensuite, le contrat. Avant de recevoir votre lien, vous le lisez et vous le signez.",
    puntos: "L'essentiel en cinq points : combien, quelles entreprises comptent pour vous, l'attente de 30 jours, le paiement, et ce qui est interdit.",
    firma: "Vous signez en écrivant votre nom…",
    dedo: "…et, si vous voulez, avec le doigt.",
    enviar: "Vous recevez un code par courriel, et votre lien est prêt. C'est gratuit, et ça prend deux minutes.",
    panel: {
      sobre: "Exemple",
      titulo: "Votre panneau d'affilié, *avec 4 entreprises qui paient*.",
      texto: "Les chiffres sont un exemple. Le panneau, lui, est exactement celui que vous aurez.",
    },
    enlace: "Votre lien. Une entreprise qui s'inscrit dans les 90 jours après l'avoir ouvert est la vôtre.",
    copiar: "Un bouton pour le copier, et vous le collez où vous voulez.",
    cifras: "Vos chiffres : ce qui attend, ce qui est disponible, et ce qui est déjà payé.",
    clientes: "Et chaque entreprise que vous avez amenée, et où elle en est : en essai, payante, ou essai terminé sans payer.",
    nombres: "Vous voyez le début du nom : assez pour la reconnaître, et ce que chacune vous a rapporté.",
    contenido: "Nos vidéos, et un texte prêt à publier avec votre lien déjà dedans.",
    pago: {
      sobre: "Le paiement",
      titulo: "De notre compte Stripe *au vôtre*, puis à votre banque.",
      texto: "Stripe vous ouvre gratuitement un compte à votre nom. Vous y entrez votre identité et votre banque : nous ne les voyons jamais.",
    },
    retirar: "Dès 50 $ disponibles, vous appuyez sur Retirer. L'argent part vers votre compte Stripe, puis vers votre banque, en quelques jours.",
    espera: "Chaque commission attend 30 jours. Si l'entreprise est remboursée, elle est annulée : c'est ce qui rend le programme honnête.",
    reglas: {
      sobre: "Les règles",
      titulo: "Recommander, *pas tromper*.",
      texto: "Pas de pourriel, pas de fausses promesses, pas de publicité sur notre nom, et jamais votre propre entreprise.",
    },
    cierre: {
      sobre: "Pour commencer",
      titulo: "Inscrivez-vous, signez, *partagez votre lien*.",
      texto: "C'est gratuit. Le lien est dans la description.",
      pie: "<b>logiciel-construction.com/afiliados</b>",
    },
  },
};

T.it = {
  problema: {
    sobre: "Conosci delle imprese edili?",
    titulo: "Pagano i loro strumenti ogni mese. *Tu potresti prenderne il 30 %.*",
    texto: "Se parli con imprese edili, su YouTube, al lavoro o nei tuoi gruppi, questo video è per te.",
  },
  plan: {
    sobre: "In questo video",
    titulo: "Il programma di affiliazione, *dall'iscrizione al pagamento*.",
    texto: "L'offerta, il contratto che firmi, il tuo link, il tuo pannello, e come arrivano i soldi in banca.",
  },
  caps: ["L'idea", "1. L'offerta", "2. L'iscrizione e il contratto", "3. Il tuo link e il tuo pannello", "4. Come vieni pagato", "Le regole"],
  franja: "In ogni pagina del nostro sito c'è questa porta: diventa affiliato.",
  oferta: "L'offerta è semplice: il 30 % di quello che paga ogni impresa che porti, per i suoi primi 12 mesi.",
  pasos: "Tre passi: ti iscrivi, condividi il tuo link, e vieni pagato da 50 dollari.",
  ejemplo: {
    sobre: "Un esempio",
    cifra: "30 %",
    titulo: "di quello che pagano, *per 12 mesi*.",
    texto: "Un'impresa con il piano Chantier paga 99 € al mese: a te ne arrivano circa 30, ogni mese. Con dieci imprese, circa 300 al mese.",
  },
  cuenta: "Per iscriverti: un'email e una password.",
  donde: "Poi il tuo nome, e dove condividerai il tuo link.",
  contrato: "Poi, il contratto. Prima di ricevere il link, lo leggi e lo firmi.",
  puntos: "L'essenziale in cinque punti: quanto, quali imprese contano per te, l'attesa di 30 giorni, il pagamento, e cosa è vietato.",
  firma: "Firmi scrivendo il tuo nome…",
  dedo: "…e, se vuoi, con il dito.",
  enviar: "Ricevi un codice per email, e il tuo link è pronto. È gratis, e ci vogliono due minuti.",
  panel: {
    sobre: "Esempio",
    titulo: "Il tuo pannello da affiliato, *con 4 imprese che pagano*.",
    texto: "Le cifre sono un esempio. Il pannello, invece, è esattamente quello che avrai.",
  },
  enlace: "Il tuo link. Un'impresa che si iscrive entro 90 giorni da quando l'ha aperto è tua.",
  copiar: "Un pulsante per copiarlo, e lo incolli dove vuoi.",
  cifras: "Le tue cifre: quello che è in attesa, quello disponibile, e quello già pagato.",
  clientes: "E ogni impresa che hai portato, e a che punto è: in prova, pagante, o prova finita senza pagare.",
  nombres: "Vedi l'inizio del nome: quanto basta per riconoscerla, e quanto ti ha fatto guadagnare.",
  contenido: "I nostri video, e un testo pronto da pubblicare con il tuo link già dentro.",
  pago: {
    sobre: "Il pagamento",
    titulo: "Dal nostro conto Stripe *al tuo*, poi alla tua banca.",
    texto: "Stripe ti apre gratis un conto a tuo nome. Lì inserisci la tua identità e la tua banca: noi non le vediamo mai.",
  },
  retirar: "Con 50 dollari disponibili, premi Preleva. I soldi vanno sul tuo conto Stripe, e poi in banca, in pochi giorni.",
  espera: "Ogni commissione aspetta 30 giorni. Se l'impresa viene rimborsata, si annulla: è questo che rende il programma onesto.",
  reglas: {
    sobre: "Le regole",
    titulo: "Consigliare, *non ingannare*.",
    texto: "Niente spam, niente false promesse, niente pubblicità sul nostro nome, e mai la tua stessa impresa.",
  },
  cierre: {
    sobre: "Per iniziare",
    titulo: "Iscriviti, firma, *condividi il tuo link*.",
    texto: "È gratis. Il link è nella descrizione.",
    pie: "<b>logiciel-construction.com/afiliados</b>",
  },
};

export const youtube = {
  fr: {
    titulo: "Gagnez 30 % en recommandant un logiciel aux entrepreneurs : le programme d'affiliation",
    descripcion: `Vous connaissez des entrepreneurs en construction ou en rénovation ? Recommandez Logiciel Construction et touchez 30 % de ce que paie chaque entreprise que vous amenez, pendant ses 12 premiers mois.

Dans cette vidéo : l'offre, l'inscription et le contrat que vous signez avant de recevoir votre lien, votre panneau d'affilié (avec des chiffres d'exemple), et comment vous êtes payé : par Stripe, sur un compte à votre nom, dès 50 $ disponibles.

Inscription gratuite. Chaque commission attend 30 jours et est annulée si l'entreprise est remboursée.`,
    hashtags: ["affiliation", "revenupassif", "construction"],
    etiquetas: ["programme d'affiliation", "affiliation logiciel", "gagner de l'argent en ligne", "revenu complémentaire", "commission récurrente", "marketing d'affiliation Québec", "logiciel construction", "entrepreneur Québec"],
  },
};

youtube.it = {
  titulo: "Guadagna il 30 % consigliando un gestionale alle imprese edili: il programma di affiliazione",
  descripcion: `Conosci imprese edili o di ristrutturazione? Consiglia Logiciel Construction e ricevi il 30 % di quello che paga ogni impresa che porti, per i suoi primi 12 mesi.

In questo video: l'offerta, l'iscrizione e il contratto che firmi prima di ricevere il link, il tuo pannello da affiliato (con cifre di esempio), e come vieni pagato: con Stripe, su un conto a tuo nome, da 50 dollari canadesi disponibili.

Iscrizione gratuita. Ogni commissione aspetta 30 giorni e si annulla se l'impresa viene rimborsata.`,
  hashtags: ["affiliazione", "guadagnareonline", "edilizia"],
  etiquetas: ["programma di affiliazione", "affiliate marketing", "guadagnare online", "reddito extra", "commissioni ricorrenti", "gestionale edilizia", "impresa edile"],
};

export default {
  formato: "horizontal-cerca",
  textos: T,
  youtube,
  paraAfiliados: true,
  contexto: () => ({ permissions: ["clipboard-read", "clipboard-write"], serviceWorkers: "block" }),
  async pasos(util) {
    const { pagina, idioma, tarjeta, capitulo, resaltar, decir, callar, ir, tocar, escribir, pausa } = util;
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    const L = etiquetas(idioma);
    const alta = ALTA[idioma];
    const tarjetaCon = (texto) => tarjetaDelPanel(pagina, texto);
    await prepararGrabacion(util);
    await pagina.goto(`${util.BASE}/${idioma}/`, { waitUntil: "networkidle" });

    await tarjeta({ ...t.problema, tipo: "problema", capitulo: t.caps[0] });
    await tarjeta({ ...t.plan });

    capitulo(t.caps[1]);
    const franja = pagina.locator(".franja-afiliados").first();
    await resaltar(franja, 2200, t.franja);
    await callar();
    await tocar(franja.locator("a").first(), 300);
    await pagina.waitForURL(/\/afiliados/, { timeout: 20_000 });
    await pagina.locator("h1").first().waitFor({ timeout: 20_000 });
    await pausa(700);
    await resaltar(pagina.locator("header").first().locator("h1"), 2400, t.oferta);
    await resaltar(pagina.locator("header ol").first(), 2400, t.pasos);
    await callar();
    await tarjeta({ ...t.ejemplo, ms: 4800 });

    capitulo(t.caps[2]);
    await decir(t.cuenta, 0, { arriba: true });
    await escribir(pagina.locator("#afiliado-email"), alta.correo);
    await escribir(pagina.locator("#afiliado-clave"), alta.clave, { rapido: true });
    await decir(t.donde, 0, { arriba: true });
    await escribir(pagina.locator("#afiliado-nombre"), alta.nombre);
    await escribir(pagina.locator("#afiliado-donde"), alta.donde, { rapido: true });
    const contrato = pagina.locator("h3").filter({ hasText: L.contratoTitulo }).locator("xpath=..");
    await resaltar(contrato.locator("h3"), 2000, t.contrato, { arriba: true });
    await resaltar(contrato.locator("ul"), 3200, t.puntos, { arriba: true });
    await decir(t.firma, 0, { arriba: true });
    await escribir(pagina.locator("#afiliado-firma"), alta.firma);
    await decir(t.dedo, 0, { arriba: true });
    await firmarConElDedo(pagina, contrato.locator("canvas"), pausa);
    await tocar(pagina.locator("#afiliado-acepta"), 500);
    await resaltar(pagina.getByRole("button", { name: L.firmarYRecibir }), 2600, t.enviar, { arriba: true });
    await callar();

    await tarjeta({
      ...t.panel,
      capitulo: t.caps[3],
      ms: 4600,
      durante: async () => {
        await conSesion(pagina);
        await ir("/afiliados/panel");
        await tarjetaCon(L.tuEnlace).waitFor({ timeout: 30_000 });
      },
    });
    await pausa(500);
    const enlace = tarjetaCon(L.tuEnlace);
    await resaltar(enlace, 2600, t.enlace);
    await decir(t.copiar, 0);
    await tocar(enlace.getByRole("button", { name: L.copiar }), 900);
    await resaltar(tarjetaCon(L.clientes).locator("xpath=.."), 2400, t.cifras, { arriba: true });
    const clientes = tarjetaCon(L.tusClientes);
    await resaltar(clientes.locator("h2"), 1200, t.clientes, { arriba: true });
    await resaltar(clientes.locator("ul"), 3000, t.nombres, { arriba: true });
    await resaltar(tarjetaCon(L.contenido), 2600, t.contenido, { arriba: true });
    await callar();

    await tarjeta({ ...t.pago, capitulo: t.caps[4], ms: 5200 });
    await resaltar(tarjetaCon(L.cobroTitulo), 3000, t.retirar, { arriba: true });
    await resaltar(tarjetaCon(L.comisiones).locator("ul").first(), 3000, t.espera, { arriba: true });
    await callar();

    await tarjeta({ ...t.reglas, tipo: "problema", capitulo: t.caps[5], ms: 5000 });
    // Sin capítulo propio: YouTube no enseña ninguno si uno dura menos de
    // diez segundos, y el cierre solo no los llega a durar.
    await tarjeta({ ...t.cierre, tipo: "resultado", ms: 6000 });
  },
};
