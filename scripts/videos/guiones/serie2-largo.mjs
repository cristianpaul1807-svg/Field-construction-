/**
 * Serie 2, el vídeo largo: el equipo en la obra, de punta a punta.
 *
 * El dueño le da su código al trabajador, ve su jornada en el calendario; el
 * trabajador entra con ese mismo código y ficha con el GPS; la oficina lo ve
 * en el mapa y encuentra sus horas listas para aprobar. Los cambios entre el
 * panel y el móvil del trabajador van tapados por las tarjetas.
 */
import { TRABAJADOR, trabajadorPreparado, fichajeDelTrabajador, cambiarCodigos } from "../demo.mjs";
import { MANANA, contextoDeObra } from "./serie2-comun.mjs";

const T = {
  fr: {
    problema: { sobre: "Le problème", titulo: "Lundi, 7 h : *où sont mes gars ?*", texto: "Des appels pour savoir qui est où, des feuilles de temps le vendredi, et des heures arrondies." },
    plan: { sobre: "Dans cette vidéo", titulo: "Votre équipe *pointée, localisée*, ses heures prêtes pour la paie.", texto: "Son code, sa journée, son pointage GPS, la carte au bureau et ses heures à approuver." },
    caps: ["Le problème", "1. Donner son accès au travailleur", "2. Sa journée au calendrier", "3. Sur le chantier, il pointe", "4. Au bureau, la carte", "5. Les heures, prêtes pour la paie", "Le résultat"],
    equipo: "Votre équipe est ici : employés, rôle, et heures de la période.",
    codigo: "Pour lui donner accès, un code. Pas de courriel, pas de mot de passe.",
    mostrar: "Le code s'affiche une seule fois : vous le lui envoyez par texto ou par WhatsApp.",
    calendario: "Sa journée est au calendrier : la démolition de la cuisine chez la famille Tremblay, de 7 h à 15 h 30.",
    movil: { sobre: "Sur son cellulaire", titulo: "Il entre avec *ce code*. C'est tout.", texto: "Rien à télécharger dans une boutique : c'est une adresse, qu'il garde sur son écran d'accueil." },
    entra: "Il tape le code…",
    dia: "…et il voit sa journée : où aller, et quoi faire.",
    elige: "Arrivé sur place, il choisit le chantier…",
    ficha: "…et il pointe. L'heure et sa position GPS sont enregistrées.",
    turno: "Le compteur tourne. Après 8 heures dans la journée, le reste part en heures supplémentaires, tout seul.",
    oficina: { sobre: "Au bureau, au même moment", titulo: "Vous savez qui est *sur quel chantier*.", texto: "Sans appeler personne." },
    mapa: "Il apparaît sur la carte, à l'adresse du chantier.",
    activos: "Et dans la liste des actifs : qui est sur place maintenant, et sur quel chantier.",
    horas: { sobre: "En fin de semaine", titulo: "Les heures sont *déjà là*.", texto: "Chaque pointage, avec l'heure et la position, prêt à approuver." },
    lista: "Chaque pointage arrive ici : le chantier, l'arrivée et le départ, et la position de chacun.",
    aprobar: "Vous approuvez, et les heures partent dans la paie et dans le rapport mensuel de la CCQ.",
    resultado: { sobre: "Le résultat", titulo: "Des heures *exactes*, sans courir après personne.", texto: "Et un client qui peut voir que l'équipe est bien sur son chantier." },
    cierre: { titulo: "Logiciel Construction", texto: "Abonnez-vous : chaque vidéo explique un processus de votre entreprise, du début à la fin.", pie: "<b>Essai gratuit de 30 jours</b> · logiciel-construction.com" },
    b: { codigo: /^Générer (un|un autre) code$/, hecho: "Terminé", entrar: "Entrer", pointage: "Pointage", llegada: "Pointer l'arrivée", turno: "Résumé du quart de travail", activos: "Actifs maintenant", aprobar: "Approuver les heures" },
  },
};

T.it = {
  problema: { sobre: "Il problema", titulo: "Lunedì, ore 7: *dove sono i miei operai?*", texto: "Telefonate per sapere chi è dove, fogli ore il venerdì, e ore arrotondate." },
  plan: { sobre: "In questo video", titulo: "La tua squadra *timbrata, localizzata*, ore pronte per le paghe.", texto: "Il suo codice, la sua giornata, la timbratura con GPS, la mappa in ufficio e le ore da approvare." },
  caps: ["Il problema", "1. Dare l'accesso all'operaio", "2. La sua giornata in agenda", "3. In cantiere, timbra", "4. In ufficio, la mappa", "5. Le ore, pronte per le paghe", "Il risultato"],
  equipo: "La tua squadra è qui: dipendenti, ruolo e ore del periodo.",
  codigo: "Per dargli l'accesso basta un codice. Niente email, niente password.",
  mostrar: "Il codice si vede una sola volta: glielo mandi per SMS o su WhatsApp.",
  calendario: "La sua giornata è in agenda: la demolizione della cucina dalla famiglia Rossi, dalle 7 alle 15 e 30.",
  movil: { sobre: "Sul suo cellulare", titulo: "Entra con *quel codice*. Tutto qui.", texto: "Niente da scaricare dagli store: è un indirizzo, che tiene sulla schermata home." },
  entra: "Scrive il codice…",
  dia: "…e vede la sua giornata: dove andare e cosa fare.",
  elige: "Arrivato sul posto, sceglie il cantiere…",
  ficha: "…e timbra. L'ora e la posizione GPS vengono registrate.",
  turno: "Il contatore gira. Dopo 8 ore nella giornata, il resto passa in straordinario, da solo.",
  oficina: { sobre: "In ufficio, nello stesso momento", titulo: "Sai chi è *in quale cantiere*.", texto: "Senza chiamare nessuno." },
  mapa: "Compare sulla mappa, nel punto in cui ha timbrato.",
  activos: "E nella lista degli attivi: chi è sul posto adesso, e in quale cantiere.",
  horas: { sobre: "A fine settimana", titulo: "Le ore sono *già lì*.", texto: "Ogni timbratura, con l'ora e la posizione, pronta da approvare." },
  lista: "Ogni timbratura arriva qui: il cantiere, l'entrata e l'uscita, e la posizione di ognuno.",
  aprobar: "Approvi, e le ore sono pronte per le paghe.",
  resultado: { sobre: "Il risultato", titulo: "Ore *esatte*, senza rincorrere nessuno.", texto: "E un cliente che può vedere che la squadra è davvero nel suo cantiere." },
  cierre: { titulo: "Logiciel Construction", texto: "Iscriviti: ogni video spiega un processo della tua impresa, dall'inizio alla fine.", pie: "<b>Prova gratuita di 30 giorni</b> · logiciel-construction.com" },
  b: { codigo: /^Genera (un altro )?codice$/, hecho: "Fatto", entrar: "Entra", pointage: "Timbratura", llegada: "Timbra entrata", turno: "Riepilogo del turno", activos: "Attivi ora", aprobar: "Approva ore" },
};

export const youtube = {
  fr: {
    titulo: "Pointage GPS, horaire et heures de vos travailleurs de la construction : le processus complet",
    descripcion: `Comment gérer une équipe sur le terrain sans courir après personne : donner un accès à un travailleur avec un simple code, planifier sa journée, le laisser pointer depuis son cellulaire avec la position GPS, le voir sur la carte au bureau, et retrouver ses heures — régulières et supplémentaires — prêtes à approuver pour la paie et le rapport mensuel de la CCQ.

Pour les entrepreneurs en construction et en rénovation au Québec.`,
    hashtags: ["construction", "chantier", "entrepreneur"],
    etiquetas: ["pointage GPS", "feuille de temps construction", "application pointage employés", "heures supplémentaires construction", "rapport mensuel CCQ", "gestion d'équipe chantier", "planification chantier", "logiciel construction", "entrepreneur Québec"],
  },
};

youtube.it = {
  titulo: "Timbratura GPS, agenda e ore degli operai edili: il processo completo",
  descripcion: `Come gestire una squadra in cantiere senza rincorrere nessuno: dare l'accesso a un operaio con un semplice codice, pianificare la sua giornata, farlo timbrare dal cellulare con la posizione GPS, vederlo sulla mappa in ufficio e ritrovare le sue ore — ordinarie e straordinarie — pronte da approvare per le paghe.

Per imprese edili e di ristrutturazione.`,
  hashtags: ["edilizia", "cantiere", "impresaedile"],
  etiquetas: ["timbratura GPS", "foglio ore cantiere", "app presenze operai", "straordinari edilizia", "gestione squadra cantiere", "pianificazione cantiere", "gestionale edilizia", "impresa edile"],
};

export default {
  formato: "horizontal",
  textos: T,
  youtube,
  // Los códigos que salen tecleados en el vídeo dejan de valer al acabar.
  despues: (util) => cambiarCodigos(util, util.idioma),
  contexto: contextoDeObra,
  async pasos({ pagina, BASE, idioma, tarjeta, capitulo, resaltar, decir, callar, entrar, navegar, api, tocar, escribir, elegir, pausa }) {
    const t = T[idioma];
    if (!t) throw new Error(`sin textos en ${idioma}`);
    const quien = TRABAJADOR[idioma];
    await entrar();
    // Sin código: se genera delante de la cámara y es el que teclea después.
    const { obra } = await trabajadorPreparado(api, idioma, MANANA, { codigo: false });
    await pagina.goto(BASE + "/technicians", { waitUntil: "networkidle" });
    // En escritorio el equipo es una tabla; la lista en tarjetas (la del
    // móvil) también está en la página, pero escondida.
    await pagina.locator("tr").filter({ hasText: quien.name }).first().waitFor({ timeout: 20_000 });

    await tarjeta({ ...t.problema, tipo: "problema", ms: 5200, capitulo: t.caps[0] });
    await tarjeta({ ...t.plan, ms: 4800 });

    // 1. El código
    capitulo(t.caps[1]);
    const fila = pagina.locator("tr").filter({ hasText: quien.name }).first();
    await resaltar(pagina.locator("table").first(), 2200, t.equipo);
    await decir(t.codigo, 0);
    await tocar(fila.getByRole("button", { name: t.b.codigo }), 1500);
    const codigo = (await pagina.getByRole("dialog").locator(".font-mono").innerText()).trim();
    await resaltar(pagina.getByRole("dialog").locator(".font-mono"), 2400, t.mostrar);
    await tocar(pagina.getByRole("dialog").getByRole("button", { name: t.b.hecho }), 600);

    // 2. Su jornada
    capitulo(t.caps[2]);
    await navegar("/scheduling", pagina.getByText(quien.tarea).first());
    await pausa(800);
    await resaltar(pagina.getByText(quien.tarea).first().locator("xpath=.."), 3000, t.calendario);

    // 3. El móvil del trabajador
    await tarjeta({
      ...t.movil, ms: 4800, capitulo: t.caps[3],
      durante: async () => {
        await pagina.goto(BASE + "/campo", { waitUntil: "networkidle" });
        await pagina.getByRole("button", { name: t.b.entrar }).waitFor({ timeout: 20_000 });
      },
    });
    await decir(t.entra, 0);
    await escribir(pagina.locator("input").first(), codigo);
    await tocar(pagina.getByRole("button", { name: t.b.entrar }), 600);
    const bloque = pagina.getByText(quien.tarea).first();
    await bloque.waitFor({ timeout: 20_000 });
    await pausa(1000);
    await resaltar(bloque.locator("xpath=.."), 2200, t.dia);
    await tocar(pagina.getByRole("tab", { name: t.b.pointage }), 900);
    await decir(t.elige, 0);
    await elegir(pagina.getByRole("combobox").first(), new RegExp(obra.name), 800);
    await decir(t.ficha, 0);
    await tocar(pagina.getByRole("button", { name: t.b.llegada }), 2400);
    await resaltar(pagina.getByText(t.b.turno).first().locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]"), 2600, t.turno);
    await callar();

    // 4. La oficina
    const marcador = pagina.getByText(quien.name).first();
    await tarjeta({ ...t.oficina, ms: 3800, capitulo: t.caps[4], durante: () => navegar("/gps-routing", marcador) });
    await pausa(1200);
    await resaltar(pagina.locator("div.touch-none").filter({ has: marcador }).first(), 2400, t.mapa);
    await resaltar(pagina.getByText(t.b.activos).first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]"), 2600, t.activos);

    // 5. Las horas: su salida (fuera de cámara, tapada) y la lista para aprobar.
    await tarjeta({
      ...t.horas, ms: 4400, capitulo: t.caps[5],
      durante: async () => {
        await fichajeDelTrabajador(pagina, codigo, quien.obra).salir();
        await navegar("/check-in", pagina.getByText(quien.name).first());
      },
    });
    const pointage = pagina.locator("div").filter({ hasText: quien.tarea }).filter({ has: pagina.getByRole("button", { name: t.b.aprobar }) }).last();
    await resaltar(pointage, 2600, t.lista);
    await resaltar(pointage.getByRole("button", { name: t.b.aprobar }), 2600, t.aprobar);
    await callar();

    await tarjeta({ ...t.resultado, tipo: "resultado", ms: 5200, capitulo: t.caps[6] });
    await tarjeta({ ...t.cierre, ms: 5600 });
  },
};
