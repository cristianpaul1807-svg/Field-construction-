/**
 * Serie 1, Short «la firma»: el gancho es el cliente que dice que firma
 * mañana y no firma nunca; debajo, el cliente entrando y firmando con el dedo.
 */
import { asegurarCliente, borrarPresupuestosDe, soumissionPreparada, cambiarCodigos } from "../demo.mjs";
import { FINAL_SERIE1 } from "./serie1-comun.mjs";

const T = {
  fr: {
    gancho: { sobre: "Entrepreneurs", titulo: "« Je signe demain. » *Et il ne signe jamais.*" },
    codigo: "Votre client entre avec un code. Pas de compte, pas de mot de passe.",
    ve: "Il voit le montant, les taxes, le PDF.",
    firmar: "Il signe avec le doigt…",
    aceptar: "…et c'est accepté. Le chantier se crée tout seul.",
    final: FINAL_SERIE1.fr,
    b: { firmar: "Signer la soumission", aceptar: "Signer et accepter", numero: "Soumission n°" },
  },
};

export const youtube = {
  fr: {
    titulo: "« Je signe demain »… et il ne signe jamais ? #shorts",
    descripcion: `Votre client reçoit la soumission sur son cellulaire, la lit, la signe avec le doigt et l'accepte. Son nom, la date et le montant restent comme preuve, et le chantier se crée tout seul.

▶ Le processus complet, de la soumission au chantier : sur la chaîne @LogicielConstruction.`,
    hashtags: ["shorts", "construction", "renovation"],
    etiquetas: ["signature électronique", "soumission construction", "entrepreneur en rénovation", "logiciel construction", "rénovation Québec"],
  },
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  // Los códigos que salen tecleados en el vídeo dejan de valer al acabar.
  despues: (util) => cambiarCodigos(util, util.idioma),
  async pasos({ pagina, BASE, idioma, gancho, soltarGancho, tarjeta, resaltar, decir, callar, entrar, api, tocar, escribir, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    // Fuera de cámara: una soumission enviada, sólo ésta, y el código.
    await entrar();
    await borrarPresupuestosDe(api, idioma);
    await soumissionPreparada(api, idioma, { enviada: true });
    const clienteId = await asegurarCliente(api, idioma);
    const acceso = await api("POST", `/api/clients/${clienteId}/access-token`);
    if (!acceso.ok) throw new Error(`no se pudo generar el código del cliente (${acceso.estado})`);
    await pagina.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k !== "fsm-language") localStorage.removeItem(k);
    });
    await pagina.goto(BASE + "/cliente/acceso", { waitUntil: "networkidle" });

    await gancho({
      ...t.gancho,
      durante: async () => {
        await escribir("#client-token", acceso.datos.token);
        await tocar('button[type="submit"]', 400);
        await pagina.getByRole("button", { name: t.b.firmar }).waitFor({ timeout: 20_000 });
      },
    });
    await soltarGancho();
    await decir(t.codigo, 0, { arriba: true });
    const recuadro = pagina.locator("div").filter({ has: pagina.getByRole("button", { name: t.b.firmar }) }).filter({ hasText: t.b.numero }).last();
    await resaltar(recuadro, 1800, t.ve, { arriba: true });
    await decir(t.firmar, 0);
    await tocar(pagina.getByRole("button", { name: t.b.firmar }), 1100);
    const lienzo = pagina.getByRole("dialog").locator("canvas");
    await lienzo.evaluate((e) => e.scrollIntoView({ block: "center" }));
    const caja = await lienzo.boundingBox();
    if (caja) {
      const x = caja.x + caja.width * 0.15, y = caja.y + caja.height * 0.62;
      await pagina.mouse.move(x, y, { steps: 6 });
      await pagina.mouse.down();
      for (const [dx, dy] of [[0.05, -0.28], [0.1, 0.1], [0.16, -0.32], [0.22, 0.12], [0.3, -0.2], [0.38, 0.06], [0.46, -0.24], [0.56, 0.1], [0.66, -0.06]]) {
        await pagina.mouse.move(x + caja.width * dx, y + caja.height * dy, { steps: 4 });
      }
      await pagina.mouse.up();
    }
    await pausa(500);
    await decir(t.aceptar, 0);
    await tocar(pagina.getByRole("button", { name: t.b.aceptar }), 2600);
    await callar();
    await tarjeta({ ...t.final, ms: 5200 });
  },
};
