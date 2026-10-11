/** El primer cliente: cómo entra alguien en el CRM y dónde se le sigue. */
const T = {
  fr: {
    intro: "Le CRM : tous vos clients et prospects au même endroit.",
    nuevo: "Un nouveau prospect vous appelle : on l'ajoute en quelques secondes.",
    nombre: "Son nom…",
    contacto: "…son téléphone et son courriel : c'est là qu'il recevra sa soumission et sa facture.",
    direccion: "L'adresse du chantier.",
    crear: "On crée la fiche.",
    lista: "Il apparaît dans la liste, au statut « Nouveau ».",
    estados: "Les cartes du haut suivent chaque client : nouveau, soumissionné, en négociation, gagné ou perdu.",
    buscar: "Pour le retrouver, on tape son nom.",
    fin: "Prochaine étape : lui préparer une soumission.",
    boton: "Nouveau prospect",
    crearBoton: "Créer",
    datos: { nombre: "Famille Tremblay", telefono: "514 555-0199", correo: "progetmanagement+tremblay@gmail.com", direccion: "4521, rue Fabre, Montréal (Québec) H2J 3V2" },
  },
};

export default {
  formato: "horizontal",
  async pasos({ pagina, idioma, decir, ir, entrar, api, tocar, escribir, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    await entrar();
    // Fuera de cámara: si ya existe de otra grabación, se borra.
    const clientes = await api("GET", "/api/clients");
    for (const c of (Array.isArray(clientes.datos) ? clientes.datos : []).filter((c) => c.name === t.datos.nombre)) {
      await api("DELETE", `/api/clients/${c.id}`);
    }

    await ir("/crm");
    await decir(t.intro, 3200);
    await decir(t.nuevo, 0);
    await tocar(pagina.getByRole("button", { name: t.boton }).first(), 1200);
    const campos = pagina.getByRole("dialog").locator("input");
    await decir(t.nombre, 0);
    await escribir(campos.nth(0), t.datos.nombre);
    await decir(t.contacto, 0);
    await escribir(campos.nth(1), t.datos.telefono);
    await escribir(campos.nth(2), t.datos.correo);
    await pausa(900);
    await decir(t.direccion, 0);
    await escribir(campos.nth(3), t.datos.direccion);
    await pausa(800);
    await decir(t.crear, 0);
    await tocar(pagina.getByRole("dialog").getByRole("button", { name: t.crearBoton }), 1800);
    await pagina.getByRole("cell", { name: t.datos.nombre }).first().waitFor({ timeout: 15_000 });
    await pagina.getByRole("cell", { name: t.datos.nombre }).first().evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" }));
    await decir(t.lista, 3400, { arriba: true });
    await pagina.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pausa(700);
    await decir(t.estados, 4200);
    await decir(t.buscar, 0);
    await escribir(pagina.getByRole("textbox").first(), "Tremb");
    await decir(t.buscar, 2200, { arriba: true });
    await decir(t.fin, 3000, { arriba: true });
  },
};
