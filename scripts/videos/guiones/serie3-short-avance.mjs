/**
 * Serie 3, Short «¿avanza?»: el gancho son las llamadas del cliente
 * preguntando; debajo, el cliente entra en su portal y lo ve él solo.
 */
import { asegurarCliente, borrarPresupuestosDe, cambiarCodigos } from "../demo.mjs";
import { FINAL_SERIE3 } from "./serie3-comun.mjs";

const T = {
  fr: {
    gancho: { sobre: "Entrepreneurs", titulo: "« Pis, ça avance ? » *Dix appels par semaine.*" },
    etapas: "Votre client voit son chantier étape par étape. L'équipe est sur place : c'est coché.",
    pagos: "Ce qu'il aura à payer, et quand.",
    escribe: "Et ses questions, il les écrit ici. Par écrit, au même endroit.",
    final: FINAL_SERIE3.fr,
    mensaje: "Est-ce que l'équipe arrive à 7 h demain ?",
    b: { etapas: "Les étapes de votre chantier", pagos: "Échéancier de paiement", mensajes: "Messages", escribir: "Écrivez un message..." },
  },
};

export const youtube = {
  fr: {
    titulo: "« Pis, ça avance ? » Dix appels par semaine ? #shorts",
    descripcion: `Avec un portail client, votre client voit son chantier étape par étape, ce qu'il aura à payer et quand, et il vous écrit au même endroit. Il entre avec un simple code, sans mot de passe.

▶ Le processus complet, du lien public au portail client : sur la chaîne @LogicielConstruction.`,
    hashtags: ["shorts", "construction", "renovation"],
    etiquetas: ["portail client", "suivi de chantier", "communication client", "logiciel construction", "rénovation Québec"],
  },
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  despues: (util) => cambiarCodigos(util, util.idioma),
  async pasos({ pagina, BASE, idioma, gancho, soltarGancho, tarjeta, resaltar, decir, callar, entrar, api, tocar, escribir, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    await entrar();
    await borrarPresupuestosDe(api, idioma);
    const clienteId = await asegurarCliente(api, idioma);
    const acceso = await api("POST", `/api/clients/${clienteId}/access-token`);
    if (!acceso.ok) throw new Error(`no se pudo generar el código del cliente (${acceso.estado})`);
    await pagina.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k !== "fsm-language") localStorage.removeItem(k);
    });
    await pagina.goto(BASE + "/cliente/acceso", { waitUntil: "networkidle" });

    const etapas = pagina.getByText(t.b.etapas).first();
    await gancho({
      ...t.gancho,
      durante: async () => {
        await escribir("#client-token", acceso.datos.token, { rapido: true });
        await tocar('button[type="submit"]', 400);
        await etapas.waitFor({ timeout: 20_000 });
      },
    });
    await soltarGancho();
    await resaltar(etapas.locator("xpath=ancestor::div[contains(@class,'rounded')][1]"), 2000, t.etapas, { arriba: true });
    await resaltar(pagina.getByText(t.b.pagos).first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]"), 1600, t.pagos, { arriba: true });
    await tocar(pagina.getByRole("tab", { name: t.b.mensajes }), 900);
    await tocar(pagina.locator("button.w-full.text-left").first(), 900);
    await decir(t.escribe, 0, { arriba: true });
    await escribir(pagina.getByPlaceholder(t.b.escribir), t.mensaje, { rapido: true });
    await tocar(pagina.locator('form button[type="submit"]').last(), 1600);
    await callar();
    await tarjeta({ ...t.final, ms: 5200 });
  },
};
