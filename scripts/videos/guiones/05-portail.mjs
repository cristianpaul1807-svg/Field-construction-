/**
 * El portal del cliente: lo que ve la familia de su obra sin tener que llamar.
 * En vertical, porque es el móvil del cliente.
 *
 * Va después del 04: con el trabajador ya fichado en la obra, la lista de
 * etapas tiene marcado que el equipo está allí, que es lo que el cliente
 * quiere saber.
 */
import { asegurarCliente } from "../demo.mjs";

const T = {
  fr: {
    problema: { sobre: "Le problème", titulo: "« Pis, ça avance ? » *Dix appels par semaine.*", texto: "Le client s'inquiète, et vous répondez au téléphone au lieu de travailler." },
    idea: { sobre: "La solution", titulo: "Un portail où votre client *voit tout*.", texto: "L'avancement, les paiements, les documents et les messages. Sans vous appeler." },
    codigo: "Votre client entre avec son code. Rien à installer, pas de mot de passe.",
    etapas: "Il voit où en est son chantier, étape par étape. L'équipe est sur place : c'est coché.",
    pagos: "Il sait ce qu'il aura à payer, et à quel moment des travaux.",
    documentos: "Sa soumission signée, ses factures, et il peut payer en ligne.",
    mensajes: "Et s'il a une question, il l'écrit ici.",
    escrito: "Tout reste par écrit, au même endroit : plus de « je pensais que c'était compris ».",
    resultado: { sobre: "Le résultat", titulo: "Moins d'appels, *un client rassuré*.", texto: "Et un client rassuré, c'est un client qui vous recommande." },
    cierre: { titulo: "Logiciel Construction", texto: "Un portail client pour chacun de vos chantiers.", pie: "<b>Essai gratuit de 30 jours</b> · logiciel-construction.com" },
    mensaje: "Bonjour ! Est-ce que l'équipe arrive à 7 h demain matin ?",
    b: {
      etapas: "Les étapes de votre chantier",
      pagos: "Échéancier de paiement",
      numero: "Soumission n°",
      mensajes: "Messages",
      escribir: "Écrivez un message...",
    },
  },
};

export const youtube = {
  fr: {
    titulo: "Un portail client pour vos chantiers de rénovation : moins d'appels, plus de confiance #shorts",
    descripcion: `« Pis, ça avance ? » Avec un portail client, votre client voit l'avancement de son chantier étape par étape, l'échéancier de paiement, sa soumission signée et ses factures, et il peut vous écrire au même endroit. Il entre avec un simple code, sans mot de passe et sans rien installer.

Pour les entrepreneurs en construction et en rénovation au Québec.`,
    hashtags: ["construction", "renovation", "shorts"],
    etiquetas: ["portail client construction", "suivi de chantier", "communication client rénovation", "entrepreneur en rénovation", "logiciel construction", "gestion de chantier", "rénovation Québec", "service client entrepreneur"],
  },
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  async pasos({ pagina, BASE, idioma, tarjeta, resaltar, decir, callar, entrar, api, tocar, escribir, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);

    // Fuera de cámara: el código del cliente (sin correo, así que no le llega
    // a nadie) y fuera la sesión del negocio, que el portal es del cliente.
    await entrar();
    const clienteId = await asegurarCliente(api, idioma);
    const acceso = await api("POST", `/api/clients/${clienteId}/access-token`);
    if (!acceso.ok) throw new Error(`no se pudo generar el código del cliente (${acceso.estado})`);
    await pagina.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k !== "fsm-language") localStorage.removeItem(k);
    });
    // Cargada entera y no con `ir`: con la sesión del negocio aún en memoria,
    // un cambio de pantalla sin recargar seguiría siendo el panel.
    await pagina.goto(BASE + "/cliente/acceso", { waitUntil: "networkidle" });

    await tarjeta({ ...t.problema, tipo: "problema", ms: 5200, capitulo: t.problema.sobre });
    await tarjeta({ ...t.idea, ms: 4600 });

    await decir(t.codigo, 0);
    await escribir("#client-token", acceso.datos.token);
    await tocar('button[type="submit"]', 600);
    const etapas = pagina.getByText(t.b.etapas).first();
    await etapas.waitFor({ timeout: 20_000 });
    await pausa(1200);

    await resaltar(etapas.locator("xpath=ancestor::div[contains(@class,'rounded')][1]"), 3000, t.etapas, { arriba: true });
    await resaltar(pagina.getByText(t.b.pagos).first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]"), 2600, t.pagos, { arriba: true });
    await resaltar(pagina.locator("div").filter({ hasText: t.b.numero }).filter({ has: pagina.getByRole("button") }).last(), 2800, t.documentos, { arriba: true });

    await tocar(pagina.getByRole("tab", { name: t.b.mensajes }), 1200);
    // La conversación con la empresa: la primera (y única) de su lista.
    await tocar(pagina.locator("button.w-full.text-left").first(), 1200);
    await decir(t.mensajes, 0, { arriba: true });
    await escribir(pagina.getByPlaceholder(t.b.escribir), t.mensaje);
    await tocar(pagina.locator('form button[type="submit"]').last(), 1500);
    await decir(t.escrito, 2600, { arriba: true });
    await callar();

    await tarjeta({ ...t.resultado, tipo: "resultado", ms: 5000, capitulo: t.resultado.sobre });
    await tarjeta({ ...t.cierre, ms: 4800 });
  },
};
