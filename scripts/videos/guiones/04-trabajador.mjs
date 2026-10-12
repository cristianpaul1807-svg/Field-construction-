/**
 * La app del trabajador: entra con un código, ve su día y ficha con el GPS.
 * Y en la oficina, en ese mismo momento, se le ve en el mapa. En vertical,
 * porque es un teléfono en una obra.
 *
 * El trabajador es uno de demostración, no uno de verdad de la cuenta: generar
 * un código nuevo deja sin acceso al que tuviera el anterior.
 */
import { CLIENTE, TRABAJADOR, primeraHora, cambiarCodigos } from "../demo.mjs";

const MANANA = primeraHora();

const T = {
  fr: {
    problema: { sobre: "Le problème", titulo: "Vendredi, les feuilles de temps. *Personne ne s'en souvient.*", texto: "Des heures arrondies, des oublis, et une paie faite de mémoire." },
    idea: { sobre: "La solution", titulo: "Le pointage, *dans sa poche*.", texto: "Pas de compte, pas de mot de passe, rien à installer : un code, et c'est parti." },
    codigo: "Votre travailleur entre avec le code que vous lui avez envoyé.",
    dia: "Il voit tout de suite sa journée : quel chantier, et quoi faire.",
    elige: "Arrivé sur place, il choisit le chantier…",
    ficha: "…et il pointe. L'heure et sa position GPS sont enregistrées.",
    cuenta: "Le compteur tourne : heures régulières et heures supplémentaires, calculées pour lui.",
    oficina: { sobre: "Au bureau, au même moment", titulo: "Vous savez qui est *sur quel chantier*.", texto: "" },
    mapa: "Il est là, sur le chantier. Sans l'appeler.",
    prueba: "Et chaque pointage reste comme preuve : pour la paie, et pour le client.",
    resultado: { sobre: "Le résultat", titulo: "Des heures *exactes*, sans courir après personne.", texto: "Elles vont directement dans la paie et dans le rapport mensuel de la CCQ." },
    cierre: { titulo: "Logiciel Construction", texto: "Le pointage GPS de vos travailleurs, depuis leur cellulaire.", pie: "<b>Essai gratuit de 30 jours</b> · logiciel-construction.com" },
    b: { entrar: "Entrer", pointage: "Pointage", llegada: "Pointer l'arrivée", recientes: "Pointages récents", turno: "Résumé du quart de travail" },
  },
};

export const youtube = {
  fr: {
    titulo: "Pointage GPS des travailleurs de la construction depuis leur cellulaire #shorts",
    descripcion: `Fini les feuilles de temps du vendredi. Votre travailleur entre avec un simple code — pas de compte, pas de mot de passe —, voit sa journée et pointe son arrivée sur le chantier. L'heure et la position GPS sont enregistrées, les heures supplémentaires calculées, et au bureau vous le voyez sur la carte au même moment. Ses heures vont directement dans la paie et le rapport mensuel de la CCQ.

Pour les entrepreneurs en construction et en rénovation au Québec.`,
    hashtags: ["construction", "chantier", "shorts"],
    etiquetas: ["pointage GPS", "feuille de temps construction", "application pointage employés", "heures travailleurs chantier", "rapport mensuel CCQ", "gestion de chantier", "logiciel construction", "entrepreneur Québec"],
  },
};

export default {
  formato: "vertical",
  textos: T,
  youtube,
  // Los códigos que salen tecleados en el vídeo dejan de valer al acabar.
  despues: (util) => cambiarCodigos(util, util.idioma),
  contexto: (idioma) => ({
    geolocation: TRABAJADOR[idioma].obra,
    permissions: ["geolocation"],
    timezoneId: MANANA.zona,
  }),
  async pasos({ pagina, idioma, tarjeta, resaltar, decir, callar, navegar, entrar, api, tocar, escribir, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    const quien = TRABAJADOR[idioma];

    // Fuera de cámara: el trabajador, su código, la obra de la familia y su
    // jornada de hoy, sin lo programado en grabaciones anteriores.
    await entrar();
    const roles = await api("GET", "/api/worker-roles");
    const rolDeCampo = (roles.datos ?? []).find((r) => r.name === "trabajador_de_campo");
    if (!rolDeCampo) throw new Error("el negocio no tiene el rol de trabajador de campo");
    let empleado = ((await api("GET", "/api/employees")).datos ?? []).find((e) => e.name === quien.name);
    if (!empleado) {
      const creado = await api("POST", "/api/employees", { name: quien.name, role: quien.role, phone: quien.phone, roleId: rolDeCampo.id });
      if (!creado.ok) throw new Error(`no se pudo crear el trabajador (${creado.estado})`);
      empleado = creado.datos;
    }
    const codigo = (await api("POST", `/api/employees/${empleado.id}/access-token`)).datos?.token;
    if (!codigo) throw new Error("no se pudo generar el código del trabajador");
    const obras = ((await api("GET", "/api/projects")).datos ?? []).filter((p) => p.clientName === CLIENTE[idioma].name);
    const obra = obras.sort((a, b) => b.budgetTotal - a.budgetTotal)[0];
    if (!obra) throw new Error("no hay obra de la familia: graba antes los vídeos 01 y 02");
    for (const e of ((await api("GET", "/api/schedule-events")).datos ?? []).filter((e) => e.assignedWorkerId === empleado.id)) {
      await api("DELETE", `/api/schedule-events/${e.id}`);
    }
    const cita = await api("POST", "/api/schedule-events", {
      projectId: obra.id,
      title: quien.tarea,
      type: "visita",
      startTime: MANANA.hora(7),
      endTime: MANANA.hora(15, 30),
      assignedEmployeeId: empleado.id,
    });
    if (!cita.ok) throw new Error(`no se pudo programar su jornada (${cita.estado})`);

    await tarjeta({ ...t.problema, tipo: "problema", ms: 5200, capitulo: t.problema.sobre });
    await tarjeta({ ...t.idea, ms: 4600, durante: () => navegar("/campo", pagina.getByRole("button", { name: t.b.entrar })) });

    await decir(t.codigo, 0);
    await escribir(pagina.locator("input").first(), codigo);
    await tocar(pagina.getByRole("button", { name: t.b.entrar }), 600);
    const bloque = pagina.getByText(quien.tarea).first();
    await bloque.waitFor({ timeout: 20_000 });
    await pausa(1500);
    await resaltar(bloque.locator("xpath=.."), 2200, t.dia, { arriba: true });

    await tocar(pagina.getByRole("tab", { name: t.b.pointage }), 1000);
    await decir(t.elige, 0, { arriba: true });
    await tocar(pagina.getByRole("combobox").first(), 900);
    await tocar(pagina.getByRole("option").filter({ hasText: obra.name }).first(), 900);
    await decir(t.ficha, 0, { arriba: true });
    await tocar(pagina.getByRole("button", { name: t.b.llegada }), 2600);
    // La tarjeta del turno, ya con la hora de entrada y el contador.
    const turno = pagina.getByText(t.b.turno).first().locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    await resaltar(turno, 2400, t.cuenta);
    await callar();

    const marcador = pagina.getByText(quien.name).first();
    await tarjeta({ ...t.oficina, ms: 3400, capitulo: t.oficina.sobre, durante: () => navegar("/gps-routing", marcador) });
    await pausa(1500);
    // El mapa entero: el más hondo de los recuadros que contienen el marcador.
    await resaltar(pagina.locator("div.touch-none").filter({ has: marcador }).first(), 2400, t.mapa, { arriba: true });
    await resaltar(pagina.getByText(t.b.recientes).locator("xpath=.."), 2600, t.prueba, { arriba: true });

    await tarjeta({ ...t.resultado, tipo: "resultado", ms: 5000, capitulo: t.resultado.sobre });
    await tarjeta({ ...t.cierre, ms: 4800 });

    // Su salida, sin cámara: que no se quede un fichaje abierto para la
    // grabación siguiente ni en las horas de la cuenta.
    await pagina.evaluate(async (obraGps) => {
      const s = JSON.parse(localStorage.getItem("fsm-worker-session") ?? "null");
      if (!s) return;
      const cabeceras = { "Content-Type": "application/json", Authorization: `Bearer ${s.token}` };
      const abierto = await fetch("/api/worker/time-entries/active", { headers: cabeceras }).then((r) => r.json()).catch(() => null);
      if (abierto?.id) {
        await fetch(`/api/worker/time-entries/${abierto.id}/check-out`, { method: "POST", headers: cabeceras, body: JSON.stringify(obraGps) });
      }
    }, quien.obra);
  },
};
