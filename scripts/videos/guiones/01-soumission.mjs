/**
 * La soumission: del problema de las noches con Excel a una soumission
 * enviada que el cliente firma desde el móvil.
 */
import { CLIENTE, asegurarCliente, borrarPresupuestosDe } from "../demo.mjs";

const T = {
  fr: {
    problema: { sobre: "Le problème", titulo: "Encore une soirée à faire des *soumissions* ?", texto: "Excel, la calculatrice, les taxes à la main… et pendant ce temps, le client attend." },
    empieza: "Voici la même soumission, faite pendant qu'on est encore sur le chantier.",
    cliente: "On choisit le client.",
    linea1: "Une ligne par travail : la céramique, au pied carré.",
    linea2: "La main-d'œuvre, à l'heure.",
    margen: "Votre marge et vos pertes : intégrées au prix, le client ne les voit pas.",
    taxes: "La TPS et la TVQ se calculent toutes seules. Pas de calculatrice.",
    pdf: "Le client reçoit un document propre, à votre nom.",
    enviar: "On l'envoie : il peut la lire et la signer depuis son cellulaire.",
    resultado: { sobre: "Le résultat", titulo: "Une soumission *propre*, envoyée avant de quitter le chantier.", texto: "Et quand le client signe, le chantier se crée tout seul." },
    cierre: { titulo: "Logiciel Construction", texto: "La gestion de votre entreprise, de la soumission au paiement.", pie: "<b>Essai gratuit de 30 jours</b> · logiciel-construction.com" },
    caps: ["Les soumissions à la main", "Marge et taxes, calculées pour vous", "L'envoyer au client", "Le résultat"],
    b: {
      nueva: "Nouvelle soumission", crear: "Créer la soumission", agregar: "Ajouter une ligne", otro: "Autre (saisir à la main)",
      guardar: "Enregistrer le brouillon", pdf: "Générer le PDF", cerrar: "Fermer", aprobar: "Approuver et marquer comme envoyée", enviar: "Approuver et envoyer",
      zona: "Ex. Cuisine", item: "Ex. Robinetterie", taxes: /TVQ/,
    },
    lineas: [
      { zona: "Salle de bain", categoria: "Matériaux", item: "Céramique murale 12 x 24 po", cantidad: "120", unidad: "pi²", precio: "6.5" },
      { zona: "Salle de bain", categoria: "Main-d'œuvre", item: "Carreleur", cantidad: "24", unidad: "h", precio: "65" },
    ],
  },
};

export const youtube = {
  fr: {
    titulo: "Faire une soumission de construction en quelques minutes, TPS et TVQ incluses",
    descripcion: `Vous passez vos soirées à faire des soumissions sur Excel ? Voici la même soumission, faite depuis le chantier : les lignes de travaux, votre marge, la TPS et la TVQ calculées toutes seules, et un PDF propre que le client peut signer depuis son cellulaire.

Pour les entrepreneurs en construction et en rénovation au Québec : salle de bain, cuisine, toiture, agrandissement… Quand le client signe, le chantier se crée tout seul.`,
    hashtags: ["construction", "renovation", "entrepreneur"],
    etiquetas: ["soumission construction", "faire une soumission", "logiciel soumission", "entrepreneur en construction", "entrepreneur général", "rénovation Québec", "TPS TVQ", "estimation travaux", "logiciel construction", "gestion de chantier", "rénovation salle de bain"],
  },
};

export default {
  formato: "horizontal",
  youtube,
  async pasos({ pagina, idioma, tarjeta, capitulo, resaltar, decir, ir, entrar, api, tocar, escribir, deslizar, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    await entrar();
    await asegurarCliente(api, idioma);
    await borrarPresupuestosDe(api, idioma);
    await ir("/budgets");

    await tarjeta({ ...t.problema, tipo: "problema", ms: 5200, capitulo: t.caps[0] });
    await decir(t.empieza, 3000);

    await decir(t.cliente, 0);
    await tocar(pagina.getByRole("button", { name: t.b.nueva }).first(), 900);
    const dialogo = pagina.getByRole("dialog");
    await tocar(dialogo.getByRole("combobox").first(), 600);
    await tocar(pagina.getByRole("option", { name: CLIENTE[idioma].name }), 600);
    await tocar(dialogo.getByRole("button", { name: t.b.crear }), 2000);

    const bloque = pagina.locator("div.border-t", { has: pagina.getByRole("heading", { name: t.b.agregar }) }).first();
    for (const [i, l] of t.lineas.entries()) {
      // La primera se ve teclear; la segunda ya no enseña nada nuevo.
      const r = { rapido: i > 0 };
      await decir(i === 0 ? t.linea1 : t.linea2, 0);
      await escribir(bloque.locator(`input[placeholder="${t.b.zona}"]`), l.zona, r);
      await tocar(bloque.getByRole("combobox").nth(0), 350);
      await tocar(pagina.getByRole("option", { name: l.categoria }), 350);
      await tocar(bloque.getByRole("combobox").nth(1), 350);
      await tocar(pagina.getByRole("option", { name: t.b.otro }), 350);
      await escribir(bloque.locator(`input[placeholder="${t.b.item}"]`), l.item, r);
      const numeros = bloque.locator('input[type="number"]');
      await escribir(numeros.nth(0), l.cantidad, r);
      await escribir(bloque.locator('input[placeholder^="m²"]'), l.unidad, r);
      await escribir(numeros.nth(1), l.precio, r);
      await tocar(bloque.getByRole("button", { name: t.b.agregar }), 1400);
    }

    capitulo(t.caps[1]);
    const reglas = pagina.locator('input[type="range"]');
    await decir(t.margen, 0);
    await deslizar(reglas.nth(0), 15);
    await deslizar(reglas.nth(1), 5);
    await tocar(pagina.getByRole("button", { name: t.b.guardar }), 2400);
    const totales = pagina.getByText(t.b.taxes).first().locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    await resaltar(totales, 3800, t.taxes, { arriba: true });

    capitulo(t.caps[2]);
    await decir(t.pdf, 0);
    await tocar(pagina.getByRole("button", { name: t.b.pdf }).first(), 3600);
    await tocar(pagina.getByRole("dialog").getByRole("button", { name: t.b.cerrar }).first(), 600);
    await decir(t.enviar, 0, { arriba: true });
    await tocar(pagina.getByRole("button", { name: t.b.aprobar }).first(), 1200);
    await tocar(pagina.getByRole("dialog").getByRole("button", { name: t.b.enviar }), 2600);

    await tarjeta({ ...t.resultado, tipo: "resultado", ms: 5200, capitulo: t.caps[3] });
    await tarjeta({ ...t.cierre, ms: 5400 });
  },
};
