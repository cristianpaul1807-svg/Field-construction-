/**
 * Serie 1, Short «la soirée»: el gancho es la noche haciendo soumissions;
 * debajo, desde el primer segundo, una hecha en el móvil. Manda al vídeo
 * largo de la serie, que es donde se explica entero.
 */
import { CLIENTE, LINEAS, asegurarCliente, borrarPresupuestosDe } from "../demo.mjs";
import { FINAL_SERIE1 } from "./serie1-comun.mjs";

const T = {
  fr: {
    gancho: { sobre: "Entrepreneurs", titulo: "Encore une soirée à faire des *soumissions* ?" },
    lineas: "Une ligne par travail, avec sa zone : la céramique, la main-d'œuvre.",
    taxes: "La marge, les pertes, la TPS et la TVQ : calculées toutes seules.",
    enviar: "Et elle part au client avant même de quitter le chantier.",
    final: FINAL_SERIE1.fr,
    b: {
      nueva: "Nouvelle soumission", crear: "Créer la soumission", agregar: "Ajouter une ligne", otro: "Autre (saisir à la main)",
      guardar: "Enregistrer le brouillon", aprobar: "Approuver et marquer comme envoyée", enviar: "Approuver et envoyer",
      zona: "Ex. Cuisine", item: "Ex. Robinetterie", taxes: /TVQ/, categoria: { Materiales: "Matériaux", "Mano de obra": "Main-d'œuvre" },
    },
  },
};

export const youtube = {
  fr: {
    titulo: "Encore une soirée à faire des soumissions ? #shorts",
    descripcion: `Une soumission de rénovation faite sur le cellulaire, avant de quitter le chantier : les lignes de travaux, la marge, la TPS et la TVQ calculées toutes seules, et envoyée au client.

▶ Le processus complet, de la soumission au chantier : sur la chaîne @LogicielConstruction.`,
    hashtags: ["shorts", "construction", "renovation"],
    etiquetas: ["soumission construction", "entrepreneur en rénovation", "logiciel construction", "TPS TVQ", "rénovation Québec"],
  },
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  async pasos({ pagina, BASE, idioma, gancho, soltarGancho, tarjeta, resaltar, decir, callar, entrar, api, tocar, elegir, escribir, deslizar, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    await entrar();
    await asegurarCliente(api, idioma);
    await borrarPresupuestosDe(api, idioma);
    await pagina.goto(BASE + "/budgets", { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: t.b.nueva }).first().waitFor({ timeout: 20_000 });

    // El gancho arriba; debajo ya se está creando la soumission.
    await gancho({
      ...t.gancho,
      durante: async () => {
        await tocar(pagina.getByRole("button", { name: t.b.nueva }).first(), 700);
        const dialogo = pagina.getByRole("dialog");
        // Mientras cargan los clientes su desplegable no existe, y el primero es
        // el de la obra, que también tiene una «Famille Tremblay»: se esperan los tres.
        for (let i = 0; i < 40 && (await dialogo.getByRole("combobox").count()) < 3; i++) await pausa(250);
        await elegir(dialogo.getByRole("combobox").first(), CLIENTE[idioma].name, 500);
        await tocar(dialogo.getByRole("button", { name: t.b.crear }), 1500);
      },
    });
    await soltarGancho();

    const bloque = pagina.locator("div.border-t", { has: pagina.getByRole("heading", { name: t.b.agregar }) }).first();
    await decir(t.lineas, 0, { arriba: true });
    for (const l of LINEAS[idioma].slice(0, 2)) {
      await escribir(bloque.locator(`input[placeholder="${t.b.zona}"]`), l.zona, { rapido: true });
      await tocar(bloque.getByRole("combobox").nth(0), 250);
      await tocar(pagina.getByRole("option", { name: t.b.categoria[l.categoria] }), 250);
      await tocar(bloque.getByRole("combobox").nth(1), 250);
      await tocar(pagina.getByRole("option", { name: t.b.otro }), 250);
      await escribir(bloque.locator(`input[placeholder="${t.b.item}"]`), l.item, { rapido: true });
      const numeros = bloque.locator('input[type="number"]');
      await escribir(numeros.nth(0), String(l.cantidad), { rapido: true });
      await escribir(bloque.locator('input[placeholder^="m²"]'), l.unidad, { rapido: true });
      await escribir(numeros.nth(1), String(l.precio), { rapido: true });
      await tocar(bloque.getByRole("button", { name: t.b.agregar }), 900);
    }
    const reglas = pagina.locator('input[type="range"]');
    await deslizar(reglas.nth(0), 15);
    await deslizar(reglas.nth(1), 5);
    await tocar(pagina.getByRole("button", { name: t.b.guardar }), 1500);
    const totales = pagina.getByText(t.b.taxes).first().locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    await resaltar(totales, 2200, t.taxes, { arriba: true });
    await decir(t.enviar, 0, { arriba: true });
    await tocar(pagina.getByRole("button", { name: t.b.aprobar }).first(), 1000);
    await tocar(pagina.getByRole("dialog").getByRole("button", { name: t.b.enviar }), 2000);
    await callar();

    await tarjeta({ ...t.final, ms: 5200 });
  },
};
