/**
 * Serie 1, el vídeo largo: de la soumission al chantier, de punta a punta.
 *
 * Es el que explica el proceso entero, con capítulos, para quien busca
 * «cómo hacer una soumission» y se queda a verlo. Los Shorts de la serie
 * (serie1-short-*) salen de sus momentos y mandan aquí.
 *
 * Pasa por las tres sesiones de verdad: el contratista hace y envía la
 * soumission, el cliente la firma en su portal, y el contratista encuentra la
 * obra ya creada. Los cambios de sesión van tapados por las tarjetas.
 */
import { CLIENTE, LINEAS, asegurarCliente, borrarPresupuestosDe } from "../demo.mjs";

const T = {
  fr: {
    problema: { sobre: "Le problème", titulo: "Encore une soirée à faire des *soumissions* ?", texto: "Excel, la calculatrice, les taxes à la main… et le client qui attend, puis qui ne signe pas." },
    plan: { sobre: "Dans cette vidéo", titulo: "De la soumission *au chantier*, sans rien ressaisir.", texto: "La créer, la faire signer au client, et voir le chantier se monter tout seul." },
    caps: ["Le problème", "1. Créer la soumission", "2. Marge, pertes et taxes", "3. Le PDF et l'envoi", "4. Le client signe sur son cellulaire", "5. Le chantier se crée tout seul", "Le résultat"],
    nueva: "Tout part d'une nouvelle soumission. On choisit le client : ses coordonnées sont déjà dans le CRM.",
    zona: "Chaque ligne appartient à une zone : la salle de bain, la cuisine, le sous-sol. Le client verra son projet pièce par pièce.",
    linea1: "Une ligne de matériaux : la céramique, au pied carré, avec son prix.",
    linea2: "La main-d'œuvre, à l'heure. Les lignes s'additionnent à mesure.",
    linea3: "Et la vanité, à l'unité. Trois lignes, et la soumission est faite.",
    margen: "Votre marge : globale, ou par section si vous voulez une marge différente sur les matériaux et sur la main-d'œuvre.",
    perdidas: "Le facteur de pertes couvre les coupes et les retailles. Les deux sont dans le prix : le client ne les voit pas ligne par ligne.",
    taxes: "La TPS à 5 % et la TVQ à 9,975 % se calculent sur la valeur complète des travaux. Le total est celui qui sera facturé.",
    pdf: "Le PDF sort à votre nom, avec votre logo et vos coordonnées. C'est le même document que le client recevra.",
    enviar: "On l'approuve et on l'envoie. Le client la retrouve dans son portail, prête à signer.",
    cliente: { sobre: "Côté client", titulo: "Votre client la reçoit *sur son cellulaire*.", texto: "Il entre avec un code que vous lui donnez : pas de compte, pas de mot de passe." },
    codigo: "Il tape son code…",
    ve: "…et il voit sa soumission : le montant, les taxes, le PDF à télécharger.",
    firmar: "Il signe avec le doigt, ou avec la souris.",
    aceptar: "Il accepte. Son nom, la date et le montant restent comme preuve sur le PDF.",
    obra: { sobre: "De retour au bureau", titulo: "Signée : le chantier est *déjà créé*.", texto: "Avec le montant accepté et son échéancier de paiement." },
    etapas: "Le chantier sait déjà où il en est : soumission acceptée. La prochaine étape, c'est de planifier les travaux.",
    pagos: "Et l'échéancier de paiement est prêt : l'acompte, le paiement d'étape et le paiement final. Chaque étape se facture quand le chantier y arrive.",
    resultado: { sobre: "Le résultat", titulo: "Une soumission faite le soir même, *signée le lendemain*.", texto: "Et rien à ressaisir : la soumission devient le chantier, puis les factures." },
    cierre: { titulo: "Logiciel Construction", texto: "Abonnez-vous : chaque vidéo explique un processus de votre entreprise, du début à la fin.", pie: "<b>Essai gratuit de 30 jours</b> · logiciel-construction.com" },
    b: {
      nueva: "Nouvelle soumission", crear: "Créer la soumission", agregar: "Ajouter une ligne", otro: "Autre (saisir à la main)",
      guardar: "Enregistrer le brouillon", pdf: "Générer le PDF", cerrar: "Fermer", aprobar: "Approuver et marquer comme envoyée", enviar: "Approuver et envoyer",
      zona: "Ex. Cuisine", item: "Ex. Robinetterie", taxes: /TVQ/, categoria: { Materiales: "Matériaux", "Mano de obra": "Main-d'œuvre" },
      firmar: "Signer la soumission", aceptarFirma: "Signer et accepter", numero: "Soumission n°",
      ciclo: "Ordre d'exécution", pagos: "Échéancier de paiement",
    },
  },
};

export const youtube = {
  fr: {
    titulo: "De la soumission au chantier : faire signer le client et démarrer sans rien ressaisir",
    descripcion: `Le processus complet, étape par étape : créer une soumission de rénovation avec ses lignes de travaux, sa marge et son facteur de pertes, la TPS et la TVQ calculées toutes seules, le PDF à votre nom, l'envoi au client, sa signature depuis son cellulaire… et le chantier qui se crée tout seul avec son échéancier de paiement.

Pour les entrepreneurs en construction et en rénovation au Québec qui passent encore leurs soirées sur Excel.`,
    hashtags: ["construction", "renovation", "entrepreneur"],
    etiquetas: ["soumission construction", "faire une soumission", "logiciel soumission", "signature électronique soumission", "entrepreneur en construction", "entrepreneur général", "rénovation Québec", "TPS TVQ", "échéancier de paiement", "gestion de chantier", "logiciel construction"],
  },
};

export default {
  formato: "horizontal",
  textos: T,
  youtube,
  async pasos({ pagina, BASE, idioma, tarjeta, capitulo, resaltar, decir, callar, entrar, api, tocar, elegir, escribir, deslizar, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    await entrar();
    await asegurarCliente(api, idioma);
    await borrarPresupuestosDe(api, idioma);
    // Cargada antes de la primera tarjeta: el vídeo empieza en ella, no aquí.
    await pagina.goto(BASE + "/budgets", { waitUntil: "networkidle" });

    await tarjeta({ ...t.problema, tipo: "problema", ms: 5200, capitulo: t.caps[0] });
    await tarjeta({ ...t.plan, ms: 4800 });

    // 1. Crear
    capitulo(t.caps[1]);
    await decir(t.nueva, 0);
    await tocar(pagina.getByRole("button", { name: t.b.nueva }).first(), 900);
    const dialogo = pagina.getByRole("dialog");
    // Mientras cargan los clientes su desplegable no existe, y el primero es
    // el de la obra, que también tiene una «Famille Tremblay»: se esperan los tres.
    for (let i = 0; i < 40 && (await dialogo.getByRole("combobox").count()) < 3; i++) await pausa(250);
    await elegir(dialogo.getByRole("combobox").first(), CLIENTE[idioma].name, 600);
    await tocar(dialogo.getByRole("button", { name: t.b.crear }), 2000);

    const bloque = pagina.locator("div.border-t", { has: pagina.getByRole("heading", { name: t.b.agregar }) }).first();
    const frases = [t.linea1, t.linea2, t.linea3];
    await decir(t.zona, 0);
    for (const [i, l] of LINEAS[idioma].entries()) {
      const r = { rapido: i > 0 };
      await decir(frases[i], 0);
      await escribir(bloque.locator(`input[placeholder="${t.b.zona}"]`), l.zona, r);
      await tocar(bloque.getByRole("combobox").nth(0), 350);
      await tocar(pagina.getByRole("option", { name: t.b.categoria[l.categoria] }), 350);
      await tocar(bloque.getByRole("combobox").nth(1), 350);
      await tocar(pagina.getByRole("option", { name: t.b.otro }), 350);
      await escribir(bloque.locator(`input[placeholder="${t.b.item}"]`), l.item, r);
      const numeros = bloque.locator('input[type="number"]');
      await escribir(numeros.nth(0), String(l.cantidad), r);
      await escribir(bloque.locator('input[placeholder^="m²"]'), l.unidad, r);
      await escribir(numeros.nth(1), String(l.precio), r);
      await tocar(bloque.getByRole("button", { name: t.b.agregar }), 1400);
    }

    // 2. Marge, pertes, taxes
    capitulo(t.caps[2]);
    const reglas = pagina.locator('input[type="range"]');
    await decir(t.margen, 0);
    await deslizar(reglas.nth(0), 15);
    await decir(t.perdidas, 0);
    await deslizar(reglas.nth(1), 5);
    await tocar(pagina.getByRole("button", { name: t.b.guardar }), 2000);
    const totales = pagina.getByText(t.b.taxes).first().locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    await resaltar(totales, 3000, t.taxes, { arriba: true });

    // 3. PDF y envío
    capitulo(t.caps[3]);
    await decir(t.pdf, 0);
    await tocar(pagina.getByRole("button", { name: t.b.pdf }).first(), 4200);
    await tocar(pagina.getByRole("dialog").getByRole("button", { name: t.b.cerrar }).first(), 600);
    await decir(t.enviar, 0, { arriba: true });
    await tocar(pagina.getByRole("button", { name: t.b.aprobar }).first(), 1200);
    await tocar(pagina.getByRole("dialog").getByRole("button", { name: t.b.enviar }), 2600);
    await callar();

    // El código del cliente y el id de esta soumission, antes de soltar la
    // sesión del negocio.
    const clienteId = await asegurarCliente(api, idioma);
    const acceso = await api("POST", `/api/clients/${clienteId}/access-token`);
    if (!acceso.ok) throw new Error(`no se pudo generar el código del cliente (${acceso.estado})`);
    const suyas = ((await api("GET", "/api/estimates")).datos ?? []).filter((e) => e.clientName === CLIENTE[idioma].name);
    const enviada = suyas.find((e) => e.status === "enviado");
    if (!enviada) throw new Error(`la soumission no quedó enviada: ${suyas.map((e) => `${e.number} ${e.status}`).join(", ")}`);

    // 4. Cliente
    const soloIdioma = () => pagina.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k !== "fsm-language") localStorage.removeItem(k);
    });
    await tarjeta({
      ...t.cliente, ms: 4800, capitulo: t.caps[4],
      durante: async () => {
        await soloIdioma();
        await pagina.goto(BASE + "/cliente/acceso", { waitUntil: "networkidle" });
      },
    });
    await decir(t.codigo, 0);
    await escribir("#client-token", acceso.datos.token);
    await tocar('button[type="submit"]', 600);
    await pagina.getByRole("button", { name: t.b.firmar }).waitFor({ timeout: 20_000 });
    await pausa(900);
    const recuadro = pagina.locator("div").filter({ has: pagina.getByRole("button", { name: t.b.firmar }) }).filter({ hasText: t.b.numero }).last();
    await resaltar(recuadro, 2400, t.ve);
    await decir(t.firmar, 0);
    await tocar(pagina.getByRole("button", { name: t.b.firmar }), 1300);
    const lienzo = pagina.getByRole("dialog").locator("canvas");
    await lienzo.evaluate((e) => e.scrollIntoView({ block: "center" }));
    const caja = await lienzo.boundingBox();
    if (caja) {
      const x = caja.x + caja.width * 0.15, y = caja.y + caja.height * 0.62;
      await pagina.mouse.move(x, y, { steps: 8 });
      await pagina.mouse.down();
      for (const [dx, dy] of [[0.05, -0.28], [0.1, 0.1], [0.16, -0.32], [0.22, 0.12], [0.3, -0.2], [0.38, 0.06], [0.46, -0.24], [0.56, 0.1], [0.66, -0.06]]) {
        await pagina.mouse.move(x + caja.width * dx, y + caja.height * dy, { steps: 5 });
      }
      await pagina.mouse.up();
    }
    await pausa(700);
    await decir(t.aceptar, 0);
    await tocar(pagina.getByRole("button", { name: t.b.aceptarFirma }), 3000);
    await callar();

    // 5. De vuelta al panel: la obra que salió de esta soumission.
    let obraId = null;
    await tarjeta({
      ...t.obra, ms: 4800, capitulo: t.caps[5],
      durante: async () => {
        await soloIdioma();
        await entrar();
        const obras = ((await api("GET", "/api/projects")).datos ?? []).filter((p) => p.clientName === CLIENTE[idioma].name);
        for (const o of obras) {
          const ficha = await api("GET", `/api/projects/${o.id}`);
          if (ficha.datos?.estimateId === enviada.id) { obraId = o.id; break; }
        }
        if (!obraId) throw new Error("no apareció la obra de la soumission firmada");
        await pagina.goto(`${BASE}/projects/${obraId}`, { waitUntil: "networkidle" });
        await pagina.getByText(t.b.pagos).first().waitFor({ timeout: 20_000 });
      },
    });
    await resaltar(pagina.getByText(t.b.ciclo).first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]"), 3000, t.etapas, { arriba: true });
    await resaltar(pagina.getByText(t.b.pagos).first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]"), 3200, t.pagos, { arriba: true });
    await callar();

    await tarjeta({ ...t.resultado, tipo: "resultado", ms: 5200, capitulo: t.caps[6] });
    await tarjeta({ ...t.cierre, ms: 5600 });
  },
};
