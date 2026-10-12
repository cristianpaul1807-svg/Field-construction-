/**
 * Serie 3, Short «el enlace»: el gancho es que la página de Facebook conteste
 * sola; debajo, el enlace del negocio y lo que ve quien lo pulsa.
 */
import { PROSPECTO, prepararCaptacion, FINAL_SERIE3, CAMPOS_DEL_BOT } from "./serie3-comun.mjs";

const T = {
  fr: {
    gancho: { sobre: "Entrepreneurs", titulo: "Votre page Facebook peut *répondre pour vous*." },
    enlace: "Votre lien est ici. Vous le copiez, et vous le mettez sur Facebook, sur Google, sur votre site.",
    cliente: { sobre: "Celui qui clique", titulo: "Un assistant lui pose *les bonnes questions*.", texto: "" },
    servicios: "Avec vos propres services. Et sa demande vous arrive, prête à chiffrer.",
    final: FINAL_SERIE3.fr,
    b: { enlace: "Votre lien", copiar: "Copier" },
  },
};

export const youtube = {
  fr: {
    titulo: "Votre page Facebook peut répondre pour vous #shorts",
    descripcion: `Un lien à mettre sur votre page Facebook, votre fiche Google ou votre site : celui qui clique tombe sur un assistant qui lui pose les bonnes questions, et sa demande de soumission vous arrive prête à chiffrer.

▶ Le processus complet, du lien public au portail client : sur la chaîne @LogicielConstruction.`,
    hashtags: ["shorts", "construction", "entrepreneur"],
    etiquetas: ["trouver des clients construction", "Facebook entrepreneur", "demande de soumission", "logiciel construction", "rénovation Québec"],
  },
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  async pasos({ pagina, BASE, idioma, gancho, soltarGancho, tarjeta, resaltar, callar, entrar, navegar, api, tocar, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    await entrar();
    const slug = await prepararCaptacion(api, idioma);
    await pagina.goto(BASE + "/settings/whatsapp", { waitUntil: "networkidle" });
    const campo = pagina.getByLabel(t.b.enlace).first();
    await campo.waitFor({ timeout: 20_000 });
    const tarjetaDelEnlace = pagina.locator('[data-slot="card"]').filter({ has: campo }).first();
    await tarjetaDelEnlace.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await pausa(500);

    await gancho({ ...t.gancho, ms: 2400 });
    await soltarGancho();
    await resaltar(tarjetaDelEnlace, 2000, t.enlace, { arriba: true });
    await tocar(tarjetaDelEnlace.getByRole("button", { name: t.b.copiar }), 900);
    await callar();
    const empezar = pagina.getByRole("button", { name: CAMPOS_DEL_BOT[idioma].empezar });
    await tarjeta({ ...t.cliente, ms: 2800, durante: () => navegar(`/c/${slug}`, empezar) });
    await tocar(empezar, 1400);
    // Los botones de los servicios, que son los del propio negocio.
    const servicio = pagina.getByRole("button", { name: PROSPECTO[idioma].servicio, exact: true });
    await servicio.waitFor({ timeout: 15_000 });
    await resaltar(servicio.locator("xpath=.."), 2400, t.servicios, { arriba: true });
    await callar();
    await tarjeta({ ...t.final, ms: 5200 });
  },
};
