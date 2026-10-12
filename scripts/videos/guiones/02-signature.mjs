/**
 * El cliente firma la soumission desde su móvil. En vertical: es lo que se
 * enseña en Shorts y Reels, y es justo lo que ve el cliente.
 */
import { CLIENTE, asegurarCliente, cambiarCodigos } from "../demo.mjs";

const T = {
  fr: {
    problema: { sobre: "Le problème", titulo: "La soumission est partie. *Et maintenant ?*", texto: "Relancer, imprimer, scanner, attendre une signature qui ne vient pas." },
    lado: "Voici ce que voit votre client, sur son cellulaire.",
    codigo: "Il entre avec le code que vous lui avez donné. Pas de mot de passe à retenir.",
    ve: "Le montant, les taxes, le PDF : tout est là.",
    firmar: "Il signe avec le doigt…",
    aceptar: "…et il accepte. Une minute, sans rien imprimer.",
    resultado: { sobre: "Le résultat", titulo: "Signée, *datée*, et le chantier est déjà créé.", texto: "Le nom, la date et le montant accepté restent comme preuve sur le PDF." },
    cierre: { titulo: "Logiciel Construction", texto: "Vos soumissions signées depuis le cellulaire du client.", pie: "<b>Essai gratuit de 30 jours</b> · logiciel-construction.com" },
    b: { firmar: "Signer la soumission", aceptar: "Signer et accepter", numero: "Soumission n°" },
  },
};

export const youtube = {
  fr: {
    titulo: "Faire signer une soumission par le client depuis son cellulaire #shorts",
    descripcion: `Fini de courir après les signatures. Votre client reçoit sa soumission, la lit sur son cellulaire, la signe avec le doigt et l'accepte. Le nom, la date et le montant restent comme preuve sur le PDF, et le chantier se crée tout seul.

Pour les entrepreneurs en construction et en rénovation au Québec.`,
    hashtags: ["construction", "renovation", "shorts"],
    etiquetas: ["signature électronique soumission", "soumission construction", "entrepreneur en construction", "rénovation Québec", "logiciel construction", "signer une soumission", "contrat de rénovation", "gestion de chantier"],
  },
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  // Los códigos que salen tecleados en el vídeo dejan de valer al acabar.
  despues: (util) => cambiarCodigos(util, util.idioma),
  async pasos({ pagina, idioma, tarjeta, resaltar, decir, ir, entrar, api, tocar, escribir, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    // Fuera de cámara, como el negocio: que haya una soumission enviada a este
    // cliente y su código de acceso.
    await entrar();
    const clienteId = await asegurarCliente(api, idioma);
    const presupuestos = await api("GET", "/api/estimates");
    const enviado = (presupuestos.datos ?? []).find((e) => e.clientName === CLIENTE[idioma].name && e.status === "enviado");
    if (!enviado) throw new Error("no hay una soumission enviada a este cliente: graba antes el vídeo 01");
    const acceso = await api("POST", `/api/clients/${clienteId}/access-token`);
    if (!acceso.ok) throw new Error(`no se pudo generar el código del cliente (${acceso.estado})`);
    await pagina.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k !== "fsm-language") localStorage.removeItem(k);
    });

    await ir("/cliente/acceso");
    await tarjeta({ ...t.problema, tipo: "problema", ms: 5000 });
    await decir(t.lado, 2600);
    await decir(t.codigo, 0);
    await escribir("#client-token", acceso.datos.token);
    await tocar('button[type="submit"]', 600);
    // Que el portal haya cargado (con el nombre del negocio) antes de seguir.
    await pagina.getByRole("button", { name: t.b.firmar }).waitFor({ timeout: 20_000 });
    await pausa(1200);

    // El recuadro de la soumission: el div más hondo que tiene a la vez el
    // número y el botón de firmar (no el plan de pagos de al lado).
    const tarjetaPresupuesto = pagina.locator("div").filter({ has: pagina.getByRole("button", { name: t.b.firmar }) }).filter({ hasText: t.b.numero }).last();
    await resaltar(tarjetaPresupuesto, 3400, t.ve);
    await decir(t.firmar, 0);
    await tocar(pagina.getByRole("button", { name: t.b.firmar }), 1300);
    const lienzo = pagina.getByRole("dialog").locator("canvas");
    await lienzo.evaluate((e) => e.scrollIntoView({ block: "center" }));
    const caja = await lienzo.boundingBox();
    if (caja) {
      const x = caja.x + caja.width * 0.15, y = caja.y + caja.height * 0.62;
      await pagina.mouse.move(x, y, { steps: 8 });
      await pagina.mouse.down();
      const puntos = [[0.05, -0.28], [0.1, 0.1], [0.16, -0.32], [0.22, 0.12], [0.3, -0.2], [0.38, 0.06], [0.46, -0.24], [0.56, 0.1], [0.66, -0.06]];
      for (const [dx, dy] of puntos) await pagina.mouse.move(x + caja.width * dx, y + caja.height * dy, { steps: 5 });
      await pagina.mouse.up();
    }
    await pausa(900);
    await decir(t.aceptar, 0);
    await tocar(pagina.getByRole("button", { name: t.b.aceptar }), 3000);
    await tarjeta({ ...t.resultado, tipo: "resultado", ms: 5000 });
    await tarjeta({ ...t.cierre, ms: 4800 });
  },
};
