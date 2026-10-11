/**
 * Por qué no hay que descargar nada: una dirección, tres puertas (el dueño,
 * el trabajador, el cliente), y cómo ponerla en la pantalla de inicio. En
 * vertical y como un iPhone, que es donde instalarla tiene pasos que contar.
 *
 * No se graba la pantalla de inicio del teléfono ni el menú de Safari: no son
 * de la aplicación, y un dibujo haciéndose pasar por ellos sería mentir. Se
 * enseña lo que la aplicación de verdad dice que hay que hacer.
 */

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const T = {
  fr: {
    problema: { sobre: "Le problème", titulo: "Encore une app à télécharger ? *Vos gars ne le feront pas.*", texto: "Les boutiques d'applications, les comptes, les mots de passe, les mises à jour…" },
    idea: { sobre: "La solution", titulo: "Une seule *adresse*, pour tout le monde.", texto: "Vous, vos travailleurs et vos clients : chacun entre par sa porte." },
    dueno: "Vous, avec votre courriel.",
    trabajador: "Vos travailleurs, avec un simple code.",
    cliente: "Vos clients, avec le leur.",
    instalar: "Et pour l'avoir comme une vraie application, sur l'écran d'accueil : trois touches dans Safari, un bouton sur Android.",
    cero: { cifra: "0", titulo: "Zéro boutique d'applications. *Zéro* mise à jour.", capitulo: "Zéro mise à jour", texto: "Quand le logiciel s'améliore, tout le monde l'a en même temps, sans rien faire." },
    resultado: { sobre: "Le résultat", titulo: "Vos gars l'utilisent *dès le premier jour*.", texto: "Parce qu'il n'y a rien à installer ni à apprendre avant de commencer." },
    cierre: { titulo: "Logiciel Construction", texto: "Une adresse, et toute votre entreprise sur le téléphone.", pie: "<b>Essai gratuit de 30 jours</b> · logiciel-construction.com" },
    b: { acceso: "Accès au système", trabajador: "Travailleur de chantier", cliente: "Portail client", instalar: "Comment l'installer", tarjetaInstalar: "Mettez-la sur votre téléphone" },
  },
};

export const youtube = {
  fr: {
    titulo: "Une application pour votre entreprise de construction, sans rien télécharger #shorts",
    descripcion: `Vos travailleurs n'iront pas chercher une application de plus dans une boutique. Ici, c'est une seule adresse : vous entrez avec votre courriel, vos travailleurs avec un simple code, vos clients avec le leur. Pour l'avoir sur l'écran d'accueil comme une vraie application, trois touches dans Safari ou un bouton sur Android — et quand le logiciel s'améliore, tout le monde l'a en même temps, sans mise à jour.

Pour les entrepreneurs en construction et en rénovation au Québec.`,
    hashtags: ["construction", "entrepreneur", "shorts"],
    etiquetas: ["application construction", "application pour entrepreneur", "logiciel construction cellulaire", "application chantier", "PWA", "gestion de chantier", "entrepreneur Québec", "logiciel construction"],
  },
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  contexto: () => ({ userAgent: IPHONE }),
  async pasos({ pagina, BASE, idioma, tarjeta, resaltar, tocar, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    // `?app=1`: la pantalla de las tres puertas, la que abre la aplicación
    // instalada. Sin el parámetro, la raíz es la web de presentación.
    // Cargada antes de la primera tarjeta, que la tapa mientras tanto.
    await pagina.goto(BASE + "/?app=1", { waitUntil: "networkidle" });
    await pagina.getByText(t.b.tarjetaInstalar).waitFor({ timeout: 20_000 });

    await tarjeta({ ...t.problema, tipo: "problema", ms: 5200, capitulo: t.problema.sobre });
    await tarjeta({ ...t.idea, ms: 4400 });

    const caja = (texto) => pagina.getByText(texto, { exact: true }).first().locator("xpath=ancestor::*[contains(@class,'rounded')][1]");
    await resaltar(caja(t.b.acceso), 1400, t.dueno);
    await resaltar(caja(t.b.trabajador), 1400, t.trabajador, { arriba: true });
    await resaltar(caja(t.b.cliente), 1400, t.cliente, { arriba: true });

    await tocar(pagina.getByText(t.b.instalar), 1200);
    await resaltar(caja(t.b.tarjetaInstalar), 3200, t.instalar, { arriba: true });
    await pausa(300);

    await tarjeta({ ...t.cero, ms: 5200 });
    await tarjeta({ ...t.resultado, tipo: "resultado", ms: 5000, capitulo: t.resultado.sobre });
    await tarjeta({ ...t.cierre, ms: 4800 });
  },
};
