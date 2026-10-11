/**
 * Configurar la empresa: lo primero que hace un negocio, y lo que sale en
 * cada presupuesto y cada factura.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOGO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "recursos", "logo-demo.png");

const T = {
  fr: {
    titulo: "Configurer votre entreprise",
    intro: "Première étape : les données de votre entreprise. Elles s'impriment sur chaque soumission et chaque facture.",
    logo: "Votre logo, en haut de chaque document.",
    nombre: "Le nom de l'entreprise, tel qu'il doit apparaître pour vos clients.",
    rbq: "Votre numéro de licence RBQ : au Québec, il doit figurer sur la soumission.",
    adresse: "L'adresse et le téléphone du bureau.",
    taxes: "Vos numéros de TPS et de TVQ : sans eux, une facture au Québec n'est pas valide.",
    retenue: "La retenue par défaut : 10 %, comme sur la plupart des chantiers au Québec.",
    guardar: "On enregistre.",
    listo: "De retour au tableau de bord, l'avertissement a disparu : l'entreprise est prête à facturer.",
    fin: "Prochaine étape : votre premier client.",
    datos: {
      nombre: "Construction Progetmanagement inc.",
      rbq: "5678-1234-01",
      direccion: "1250, rue Sainte-Catherine Ouest, Montréal (Québec) H3G 1P1",
      telefono: "514 555-0142",
      tps: "123456789 RT0001",
      tvq: "1234567890 TQ0001",
      retenue: "10",
    },
    guardarBoton: "Enregistrer les modifications",
    panel: "Tableau de bord",
  },
};

export default {
  formato: "horizontal",
  async pasos({ pagina, idioma, decir, ir, entrar, tocar, escribir, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    await entrar();
    await ir("/settings/company");
    await decir(t.intro, 3800);

    await decir(t.logo, 0);
    const [selector] = await Promise.all([pagina.waitForEvent("filechooser"), tocar(pagina.getByRole("button", { name: /logo/i }).first(), 300)]);
    await selector.setFiles(LOGO);
    await pausa(2200);

    await decir(t.nombre, 0);
    await pagina.fill("#name", "");
    await escribir("#name", t.datos.nombre);

    await decir(t.rbq, 0);
    await pagina.fill("#license", "");
    await escribir("#license", t.datos.rbq);
    await pausa(1200);

    await decir(t.adresse, 0);
    await pagina.fill("#address", "");
    await escribir("#address", t.datos.direccion);
    await pagina.fill("#company-phone", "");
    await escribir("#company-phone", t.datos.telefono);

    await decir(t.taxes, 0);
    await pagina.fill("#gst", "");
    await escribir("#gst", t.datos.tps);
    await pagina.fill("#qst", "");
    await escribir("#qst", t.datos.tvq);
    await pausa(1200);

    await decir(t.retenue, 0);
    await pagina.fill("#holdback", "");
    await escribir("#holdback", t.datos.retenue);
    await pausa(1500);

    await decir(t.guardar, 0);
    await tocar(pagina.getByRole("button", { name: t.guardarBoton }), 2200);
    // Al panel por el menú: la dirección «/» la contesta el sitio público.
    await tocar(pagina.getByRole("link", { name: t.panel }).first(), 1800);
    await decir(t.listo, 4200);
    await decir(t.fin, 2800);
  },
};
