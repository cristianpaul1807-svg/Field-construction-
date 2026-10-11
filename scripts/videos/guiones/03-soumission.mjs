/** El presupuesto: de las líneas al PDF y al cliente. */
import { CLIENTE, asegurarCliente, borrarPresupuestosDe } from "../demo.mjs";

const T = {
  fr: {
    intro: "Préparer une soumission pour la famille Tremblay : leur salle de bain.",
    nueva: "Nouvelle soumission, pour ce client.",
    zona: "Chaque ligne va dans une zone du chantier : ici, la salle de bain.",
    material: "D'abord le matériau : la céramique, avec sa quantité, son unité et son prix.",
    manoObra: "Puis la main-d'œuvre : le carreleur, à l'heure.",
    margen: "Votre marge et le facteur de pertes : le client ne les voit pas, ils sont intégrés au prix.",
    totales: "Le total avant taxes, la TPS et la TVQ, calculés tout seuls.",
    pdf: "L'aperçu du PDF avant l'envoi : le client ne voit que les lignes que vous cochez, et le total.",
    enviar: "On l'envoie : le client la reçoit et peut la signer depuis son téléphone.",
    fin: "Prochaine étape : quand il accepte, le chantier se crée tout seul.",
    b: {
      nueva: "Nouvelle soumission", crear: "Créer la soumission", agregar: "Ajouter une ligne", otro: "Autre (saisir à la main)",
      catalogo: "Choisir dans le catalogue", materiales: "Matériaux", manoObra: "Main-d'œuvre", guardar: "Enregistrer le brouillon",
      pdf: "Générer le PDF", cerrar: "Fermer", aprobar: "Approuver et marquer comme envoyée", enviar: "Approuver et envoyer",
    },
    lineas: [
      { zona: "Salle de bain", categoria: "Matériaux", item: "Céramique murale 12 x 24 po", cantidad: "120", unidad: "pi²", precio: "6.5" },
      { zona: "Salle de bain", categoria: "Main-d'œuvre", item: "Carreleur", cantidad: "24", unidad: "h", precio: "65" },
    ],
  },
};

export default {
  formato: "horizontal",
  async pasos({ pagina, idioma, decir, ir, entrar, api, tocar, escribir, deslizar, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    await entrar();
    await asegurarCliente(api, idioma);
    await borrarPresupuestosDe(api, idioma);

    await ir("/budgets");
    await decir(t.intro, 3200);
    await decir(t.nueva, 0);
    await tocar(pagina.getByRole("button", { name: t.b.nueva }).first(), 1000);
    const dialogo = pagina.getByRole("dialog");
    await tocar(dialogo.getByRole("combobox").first(), 700);
    await tocar(pagina.getByRole("option", { name: CLIENTE[idioma].name }), 700);
    await tocar(dialogo.getByRole("button", { name: t.b.crear }), 2200);

    const bloque = pagina.locator("div.border-t", { has: pagina.getByRole("heading", { name: t.b.agregar }) }).first();
    for (const [i, l] of t.lineas.entries()) {
      await decir(i === 0 ? t.zona : t.manoObra, 0);
      await escribir(bloque.locator('input[placeholder="Ex. Cuisine"]'), l.zona);
      if (i === 0) await pausa(900);
      await tocar(bloque.getByRole("combobox").nth(0), 600);
      await tocar(pagina.getByRole("option", { name: l.categoria }), 600);
      if (i === 0) await decir(t.material, 0);
      await tocar(bloque.getByRole("combobox").nth(1), 600);
      await tocar(pagina.getByRole("option", { name: t.b.otro }), 600);
      await escribir(bloque.locator('input[placeholder="Ex. Robinetterie"]'), l.item);
      const numeros = bloque.locator('input[type="number"]');
      await escribir(numeros.nth(0), l.cantidad);
      await escribir(bloque.locator('input[placeholder^="m²"]'), l.unidad);
      await escribir(numeros.nth(1), l.precio);
      await tocar(bloque.getByRole("button", { name: t.b.agregar }), 1800);
    }

    await decir(t.margen, 0);
    const reglas = pagina.locator('input[type="range"]');
    await deslizar(reglas.nth(0), 15);
    await deslizar(reglas.nth(1), 5);
    await pausa(800);
    await tocar(pagina.getByRole("button", { name: t.b.guardar }), 2500);
    // Guardar vuelve a pintar el constructor: se baja otra vez hasta los totales.
    await pagina.getByText(/TVQ/).first().evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" }));
    await pausa(600);
    await decir(t.totales, 3600, { arriba: true });

    await decir(t.pdf, 0);
    await tocar(pagina.getByRole("button", { name: t.b.pdf }).first(), 3800);
    await tocar(pagina.getByRole("dialog").getByRole("button", { name: t.b.cerrar }).first(), 800);

    await decir(t.enviar, 0, { arriba: true });
    await tocar(pagina.getByRole("button", { name: t.b.aprobar }).first(), 1200);
    await tocar(pagina.getByRole("dialog").getByRole("button", { name: t.b.enviar }), 3000);
    await decir(t.fin, 3200, { arriba: true });
  },
};
