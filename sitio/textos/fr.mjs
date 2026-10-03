/* Français du Québec — la langue de référence du site.
 *
 * Elle est la référence pour deux raisons : la Loi 96 exige le français dans
 * la communication commerciale destinée au Québec, et c'est la langue dans
 * laquelle le texte a été écrit. Les autres en sont la traduction, et
 * `construir.mjs` refuse de générer si une clé manque quelque part.
 */
export default {
  lang: "fr-CA",
  codigo: "fr",
  nombre: "Français",
  rutas: {
    inicio: "",
    funciones: "fonctionnalites",
    ccq: "ccq-taxes",
    paises: "pays",
    precios: "tarifs",
    contacto: "support",
    privacidad: "confidentialite",
    condiciones: "conditions",
  },
  marca: { sub: "Construction" },
  nav: {
    inicio: "Accueil",
    funciones: "Fonctionnalités",
    paises: "Votre pays",
    ccq: "Guide Québec : CCQ et taxes",
    precios: "Tarifs",
    probar: "Essai",
    hablar: "Support",
    entrar: "Connexion",
    idioma: "Langue",
  },
  pie: {
    tagline: "Le logiciel de gestion des entreprises de construction. Dans votre langue, avec les règles de votre pays.",
    producto: "Le produit",
    empezar: "Commencer",
    legal: "Légal",
    ensayo: "Essai de 30 jours",
    derechos: "© 2026 Logiciel Construction",
    hecho: "Québec · Italie · Données hébergées au Canada",
  },
  inicio: {
    meta: {
      title: "Logiciel Construction — Vous construisez. La paperasse se fait toute seule.",
      desc: "Soumissions signées par le client sur son téléphone, pointage GPS, factures avec les taxes de votre pays, paiements et marge de chaque chantier à jour. Et vous le demandez de vive voix. Québec et Italie, en quatre langues. Essai de 30 jours sans carte.",
    },
    sobretitulo: "Logiciel de gestion pour les entreprises de construction",
    h1: "Vous construisez. La paperasse se fait toute seule.",
    entradilla:
      "Des soumissions que le client signe sur son téléphone, des heures pointées depuis le chantier, des factures avec les taxes de votre pays et la marge de chaque chantier à jour. Et quand vous ne voulez rien chercher, vous le demandez de vive voix.",
    cta: "Essayer 30 jours — sans carte",
    cta2: "Voir ce que ça règle",
    bajo: "Travailleurs sur le terrain illimités · Mois par mois, sans contrat · Français, anglais, espagnol et italien",
    escena: {
      gpsTitulo: "Pointage GPS",
      gpsQuien: "Franck — 777 rue Campbell",
      gpsEstado: "Sur le chantier",
      gpsLlegada: "Arrivée",
      gpsHora: "7 h 04",
      vozTitulo: "Demandez-le de vive voix",
      vozPregunta: "Qui me doit de l'argent ?",
      vozRespuesta: "Trois factures en attente, 18 450 $. La plus vieille date de 41 jours : Rénovations Tremblay.",
      facturaTitulo: "Facture 2026-0014",
      facturaFilas: [
        ["Travaux exécutés", "5 000,00 $"],
        ["TPS 5 %", "250,00 $"],
        ["TVQ 9,975 %", "498,75 $"],
        ["Retenue 10 %", "−500,00 $"],
      ],
      facturaPagar: "À payer",
      facturaTotal: "5 248,75 $",
      firmaTitulo: "Soumission",
      firmaQuien: "Rénovations Tremblay",
      firmaEstado: "Acceptée",
      firmaCuando: "Aujourd'hui, 9 h 14, sur son téléphone",
      firmaImporte: "48 750,00 $",
      firmaPie: "Le chantier s'est créé tout seul, avec son échéancier de paiements.",
      telFecha: "Mercredi 16 septembre",
      telObra: "777 rue Campbell",
      telEnCurso: "En cours",
      telTarea: "Charpente des murs extérieurs",
      telGente: "Franck, Abel",
      telHoy: "Aujourd'hui",
      telHora: "7 h 04 → en cours",
      telFichado: "● Pointé sur le chantier",
      telFoto: "Ajouter une photo",
    },
    resuelveSobre: "Ce qu'on règle",
    resuelveH2: "Six problèmes de chaque semaine. Réglés.",
    resuelveEntradilla:
      "Pas de théorie : ce qui se passe aujourd'hui dans une entreprise de construction, et ce qui se passe quand vous le gérez ici.",
    antes: "Avant",
    ahora: "Maintenant",
    resuelve: [
      {
        antes: "Le client met deux semaines à répondre à la soumission, et finit par la signer sur papier.",
        ahora: "Il l'ouvre sur son téléphone et l'accepte. Le chantier se crée tout seul, avec son échéancier, et vous êtes averti.",
      },
      {
        antes: "Les heures arrivent le vendredi sur des bouts de papier, et le temps supplémentaire se discute.",
        ahora: "Chacun pointe depuis le chantier, avec le GPS. Les heures normales et supplémentaires se séparent seules ; vous approuvez.",
      },
      {
        antes: "Vous apprenez à la fin de l'année qu'un chantier a perdu de l'argent.",
        ahora: "Le dépensé, le facturé et la marge de chaque chantier, à jour. Vous le savez quand vous pouvez encore agir.",
      },
      {
        antes: "Facturer, c'est un après-midi avec un tableur et la calculatrice des taxes.",
        ahora: "La facture sort avec les taxes de votre pays, la retenue et son numéro. En Italie, aussi le XML pour le SDI.",
      },
      {
        antes: "Se faire payer, c'est courir après : appels, virements sans référence, factures oubliées.",
        ahora: "Le client paie depuis sa facture, ou par virement avec le libellé exact. Vous voyez qui vous doit et depuis quand.",
      },
      {
        antes: "Quelqu'un arrive sur le chantier avec sa formation sécurité expirée, et personne ne le savait.",
        ahora: "Chaque document a sa date d'expiration. Trente jours avant, le système vous prévient.",
      },
    ],
    vozSobre: "Personne d'autre ne fait ça",
    vozH2: "Ne cherchez pas. Demandez.",
    vozP:
      "Branchez votre assistant d'intelligence artificielle — Claude, ou tout autre compatible MCP — et posez-lui la question comme à votre associé. Il répond avec vos vraies données, dans votre langue, et seulement avec ce que cette personne a le droit de voir.",
    vozNota: "Il consulte et calcule ; il ne change rien à vos données. Un contremaître ne voit pas la marge, même en la demandant.",
    vozEjemplos: [
      {
        pregunta: "Qui me doit de l'argent, et depuis quand ?",
        respuesta: "Trois factures en attente, 18 450 $ au total. La plus vieille date de 41 jours : Rénovations Tremblay, 6 200 $.",
      },
      {
        pregunta: "Calcule la facture de 30 % du chantier de la rue Campbell.",
        respuesta: "Travaux 14 625,00 $, TPS 731,25 $, TVQ 1 458,84 $ et retenue −1 462,50 $. À payer : 15 352,59 $.",
      },
      {
        pregunta: "Quels documents expirent ce mois-ci ?",
        respuesta: "Deux : la formation sécurité de Marc, le 12, et l'assurance de Construction Lavoie, le 28.",
      },
    ],
    paisSobre: "Les règles de votre pays, intégrées",
    paisH2: "Ce qui change d'un pays à l'autre est déjà fait.",
    paisP:
      "Les taxes, la facture, la paie et les documents ne sont pas les mêmes à Montréal qu'à Rome. Le système le sait par le pays de votre entreprise, et ne vous montre que ce qui est à vous.",
    idiomasSobre: "Chacun dans sa langue",
    idiomasH2: "Vous dans votre langue. Votre équipe, dans la sienne.",
    idiomasP1:
      "Le même système, en même temps, en français, en anglais, en espagnol et en italien. Le contremaître lit son bon de travail dans sa langue, et vous lisez le vôtre dans la vôtre.",
    idiomasP2:
      "Sur un chantier où travaillent des gens de trois pays, c'est la différence entre une consigne comprise et une consigne devinée.",
    ejemploTarea: "Charpente des murs extérieurs",
    preguntasSobre: "Les questions qui reviennent toujours",
    preguntasH2: "Avant que vous les posiez.",
    preguntas: [
      {
        q: "Est-ce que ça fonctionne dans mon pays ?",
        a: [
          "Le chantier, le pointage, les clients, les soumissions et le portail fonctionnent dans tous les pays et en quatre langues.",
          "Les taxes et la facture légale sont complètes pour le Québec (Canada) et l'Italie. Les autres pays s'activent quand ils sont complets : avant, on ne vous laisse pas émettre une facture que votre comptable devrait refaire.",
        ],
      },
      {
        q: "Est-ce que ça remplace mon comptable ?",
        a: [
          "Non, et il faut le dire clairement. Les déclarations et la fin d'année restent les siennes.",
          "Ce qu'on lui enlève, c'est courir après les heures et les factures : tout lui arrive en ordre, avec un export pensé pour lui. Vous lui payez moins d'heures, pour le travail qui les vaut vraiment.",
        ],
      },
      {
        q: "C'est quoi, le demander de vive voix ?",
        a: [
          "Vous branchez votre assistant d'intelligence artificielle à votre compte et vous lui demandez dans votre langue : qui vous doit, combien d'heures quelqu'un a fait ce mois-ci, combien coûterait une facture.",
          "Il consulte et calcule seulement, avec les permissions de chaque personne. Si quelqu'un ne voit pas un écran dans le système, il ne le voit pas non plus en le demandant.",
        ],
      },
      {
        q: "Combien coûte un travailleur de plus ?",
        a: [
          "Rien. Les travailleurs entrent avec leur code dans l'application terrain, et ils sont illimités dans tous les forfaits.",
          "C'est voulu : faire payer par tête punit exactement ce dont le système a besoin pour fonctionner, que toute l'équipe pointe.",
        ],
      },
      {
        q: "Et si je veux partir ?",
        a: [
          "Mois par mois, sans contrat. Vous partez quand vous voulez.",
          "Et vos données sont à vous : vous les téléchargez au complet, quand vous voulez, sans demander à personne.",
        ],
      },
      {
        q: "Est-ce que ça fonctionne sur le chantier, sans réseau ?",
        a: [
          "L'application terrain s'installe sur le téléphone comme n'importe quelle autre et elle est faite pour s'utiliser avec une main sale et une barre de réseau.",
          "Le pointage, les photos et les bons de travail, c'est ce que touche votre équipe — le reste du système n'est pas sur leur téléphone, et c'est voulu.",
        ],
      },
    ],
    cierreH2: "Essayez-le avec vos vrais chantiers.",
    cierreP:
      "30 jours, sans carte. Dans les deux premiers jours, on entre vos trois derniers chantiers avec vous — pour que vous le voyiez avec les vôtres et pas avec des exemples inventés.",
    cierreCta: "Commencer l'essai",
    cierreCta2: "Voir les tarifs",
  },
  funciones: {
    meta: {
      title: "Fonctionnalités — Chantier, clients, argent et règles de votre pays | Logiciel Construction",
      desc: "Pointage GPS, photos, bons de travail, soumissions signées sur téléphone, factures avec les taxes de votre pays, décomptes progressifs, marge par chantier, portail client, et tout ça demandé de vive voix.",
    },
    sobretitulo: "Fonctionnalités",
    h1: "Cinq morceaux de votre journée, dans le même outil.",
    entradilla:
      "Ici, aucune case cochée dans une liste. Chaque chose existe parce qu'une entreprise de construction la fait déjà, à la main, chaque semaine.",
    bloques: [
      {
        icono: "chantier",
        t: "Le chantier",
        p: "Ce qui se passe dehors, sur le téléphone de votre équipe. Ils installent l'application, entrent avec un code, et c'est tout ce qu'ils voient.",
        items: [
          { t: "Pointage GPS", p: "Arrivée et départ depuis le chantier, avec l'endroit. Les heures normales et supplémentaires se séparent seules." },
          { t: "Des photos qui se classent seules", p: "Prises sur le chantier, elles vont directement au dossier du travail. Fini les photos perdues dans une conversation." },
          { t: "Bons de travail et horaire", p: "Qui va où, quand, et pour faire quoi. Dans la langue de chaque personne." },
          { t: "Ordres de changement", p: "Ce qui s'ajoute en cours de route, écrit, chiffré et approuvé. La moitié des discussions de fin de chantier viennent de là." },
          { t: "Les documents qui expirent", p: "Formations, examens médicaux, assurances, certificats : chacun avec sa date, et l'avis trente jours avant." },
        ],
      },
      {
        icono: "clientes",
        t: "Les clients",
        p: "Un client qui voit l'avancement appelle moins. Et une entreprise qui répond vite semble deux fois plus grosse quand elle compétitionne pour un contrat.",
        items: [
          { t: "Soumissions acceptées sur téléphone", p: "Il l'ouvre, la lit, l'accepte. Avec la date et la trace de qui l'a acceptée." },
          { t: "Portail client", p: "Ses photos, son avancement, ses factures. À votre image, pas à la nôtre." },
          { t: "Un lien public pour les demandes", p: "Pour votre bio Instagram ou votre message d'accueil WhatsApp. Ce qui entre par là devient une fiche client, pas un message perdu." },
          { t: "Toutes les conversations au même endroit", p: "Ce que le client a demandé et quand, sans chercher dans trois applications." },
        ],
      },
      {
        icono: "dinero",
        t: "L'argent",
        p: "Bien facturer, être payé plus vite, et la seule question qui compte vraiment : ce chantier fait-il de l'argent ?",
        items: [
          { t: "Les taxes de votre pays, bien faites", p: "Calculées sur la pleine valeur des travaux et arrondies une seule fois. Comme votre comptable en a besoin." },
          { t: "Retenue de garantie", p: "Déduite du paiement, pas de la facture ; gardée chantier par chantier et libérée dans la facture finale." },
          { t: "Décomptes progressifs", p: "Vous mesurez le % fait de chaque poste, la différence se facture au prix du contrat, et l'acompte se récupère tout seul." },
          { t: "Paiement par carte ou virement", p: "Le client paie depuis sa facture. L'argent va dans votre compte, pas dans le nôtre." },
          { t: "Marge par chantier, en temps réel", p: "Le dépensé, le facturé, ce qui reste. Aujourd'hui, pas à la fin de l'année." },
          { t: "Notes de crédit", p: "Une facture émise ne se modifie pas : elle se corrige avec une note de crédit, comme il se doit." },
        ],
      },
      {
        icono: "cumplimiento",
        t: "Les règles de votre pays",
        p: "La partie que personne n'aime et que tout le monde doit faire. Elle change d'un pays à l'autre, et le système sait lequel est le vôtre.",
        items: [
          { t: "Québec : rapport mensuel de la CCQ", p: "Avec les heures déjà pointées, du dimanche au samedi, avec le métier, le statut, le secteur et la région de chaque personne. Prêt le 15.", enlace: "ccq", enlaceTexto: "Comment ça marche" },
          { t: "Québec : paie, T4 et QuickBooks", p: "RRQ, RQAP et assurance-emploi ; et votre comptabilité, synchronisée toute seule." },
          { t: "Italie : facture électronique", p: "Le XML FatturaPA de chaque facture, validé contre le schéma officiel, avec la TVA de chaque chantier et l'autoliquidation." },
          { t: "Italie : congruità, bonus et DURC", p: "Combien de main-d'œuvre exige la Cassa Edile, le virement « parlant » des bonus et les documents qui expirent.", enlace: "paises", enlaceTexto: "Tout sur l'Italie" },
          { t: "Vos numéros fiscaux sur vos documents", p: "Licence, numéros de taxes ou Partita IVA : sur la soumission et la facture, là où ils doivent être." },
        ],
      },
      {
        icono: "voz",
        t: "Demandez-le de vive voix",
        p: "Votre assistant d'intelligence artificielle, branché sur vos données. Vous lui demandez dans votre langue et il répond avec vos chiffres.",
        items: [
          { t: "Qui vous doit", p: "Les factures en attente, combien et depuis quand." },
          { t: "Combien coûterait une facture", p: "Avec les taxes de votre pays et la retenue, avant de l'émettre." },
          { t: "Les heures du mois", p: "De chaque personne, avec le temps supplémentaire et les absences à part." },
          { t: "Ce qui expire", p: "Les documents de votre équipe et de vos sous-traitants qui arrivent à échéance." },
          { t: "Avec les permissions de chacun", p: "Il consulte et calcule, sans rien changer. Ce que quelqu'un ne voit pas dans le système, il ne le voit pas non plus en le demandant." },
        ],
      },
    ],
    noSobre: "Et ce qu'on ne fait pas",
    noH2: "On préfère vous le dire avant.",
    no: [
      { t: "On ne transmet pas à votre place", p: "On prépare le rapport de la CCQ et le XML de la facture italienne. C'est vous, ou votre comptable, qui les transmettez." },
      { t: "On ne remplace pas votre comptable", p: "Les déclarations et la fin d'année restent les siennes. Tout lui arrive en ordre." },
      { t: "Pas encore plusieurs entreprises", p: "Chaque entreprise a son compte. Si c'est votre cas, écrivez-nous : on veut savoir ce qu'il vous faut avant de le construire." },
    ],
    cierreH2: "Le plus simple, c'est de le voir avec vos chantiers.",
    cierreP: "30 jours, sans carte. On entre vos trois derniers chantiers avec vous dans les deux premiers jours.",
    cierreCta: "Commencer l'essai",
    cierreCta2: "Voir les tarifs",
  },
  ccq: {
    meta: {
      title: "Rapport mensuel CCQ, retenue de 10 % et taxes — ce qu'un entrepreneur du Québec doit savoir",
      desc: "Le rapport mensuel de la CCQ, la retenue contractuelle de 10 %, la TPS de 5 % et la TVQ de 9,975 % expliquées simplement pour les entrepreneurs en construction du Québec. Dates, pénalités et erreurs fréquentes.",
    },
    sobretitulo: "Guide",
    h1: "CCQ, retenue de 10 % et taxes : ce qui compte vraiment",
    entradilla:
      "Les dates, les pourcentages et les erreurs qui coûtent cher, expliqués sans jargon. Écrit pour un entrepreneur, pas pour un comptable.",
    h2ccq: "Le rapport mensuel de la CCQ",
    pccq:
      "Si vos travaux sont assujettis à la **loi R-20** — c'est le cas de presque toute la construction au Québec — vous devez transmettre chaque mois à la Commission de la construction du Québec qui a travaillé, dans quel métier, avec quel statut, dans quel secteur et dans quelle région, combien d'heures et combien la personne a gagné.",
    h3fecha: "La date : le 15",
    pfecha1:
      "Le rapport est dû **au plus tard le 15 du mois suivant**. Et il faut le transmettre **même si personne n'a travaillé** ce mois-là — un mois vide se déclare vide, il ne se saute pas.",
    pfecha2:
      "Les pénalités de retard montent, et elles peuvent atteindre **20 %**. C'est beaucoup d'argent pour une date oubliée pendant une semaine chargée.",
    h3semana: "Les semaines vont du dimanche au samedi",
    psemana:
      "C'est l'erreur la plus fréquente et la plus facile à faire : les heures ne se déclarent pas par mois, elles se déclarent **par semaine, du dimanche au samedi**. Un mois qui commence un mercredi a une première semaine coupée, et une paie hebdomadaire qui part le jeudi ne correspond pas aux semaines de la CCQ.",
    h3oficio: "Le métier et le statut ne sont pas des détails",
    poficio1:
      "Le métier (charpentier-menuisier, briqueteur-maçon…) et le statut (apprenti ou compagnon) déterminent le taux prévu à la convention collective. Le secteur (résidentiel, institutionnel et commercial, industriel, génie civil) et la région aussi.",
    poficio2:
      "Comme ces informations changent dans le temps — quelqu'un devient compagnon, un chantier change de région — elles appartiennent à l'entente de travail de la période, pas à la fiche de la personne. Le rapport de mars doit continuer de dire ce qui était vrai en mars.",
    avisoCcq1:
      "**Ce que notre système fait.** Il prépare le rapport du mois avec les heures déjà pointées, découpées du dimanche au samedi, avec le métier, le statut, le secteur et la région de chaque personne tels qu'ils étaient à ce moment-là. Il vous dit aussi ce qui manque avant que la CCQ vous le dise.",
    avisoCcq2:
      "**Ce qu'il ne fait pas.** Il ne transmet rien à la CCQ. Vous révisez le rapport et vous le déposez vous-même sur le site de la CCQ. La CCQ ne publie pas de format d'envoi par système — le jour où elle le fera, on le fera.",
    h2retencion: "La retenue contractuelle de 10 %",
    pretencion:
      "En construction, le client retient habituellement **10 % du montant des travaux** jusqu'à la fin, comme garantie que tout sera terminé et corrigé. C'est normal et c'est prévu au contrat.",
    h3error: "L'erreur qui coûte le plus cher",
    perror:
      "Les taxes se calculent sur **la valeur complète des travaux**, pas sur le montant réduit. C'est le **paiement** qui est diminué de la retenue, pas la facture.",
    tablaCabecera: "Sur une facture de 5 000 $",
    tablaMonto: "Montant",
    tabla: [
      ["Travaux exécutés", "5 000,00 $"],
      ["TPS 5 % — sur la valeur complète", "250,00 $"],
      ["TVQ 9,975 % — sur la valeur complète", "498,75 $"],
      ["Retenue 10 % — sur les travaux, pas sur les taxes", "−500,00 $"],
      ["**À payer maintenant**", "**5 248,75 $**"],
      ["À libérer à la fin", "500,00 $"],
    ],
    polvidar:
      "L'autre erreur, plus tranquille et plus chère : **oublier de la réclamer**. La retenue reste ouverte des mois, le chantier se termine, et personne ne revient chercher les 500 $. Sur dix chantiers dans une année, c'est un salaire.",
    h2taxes: "La TPS et la TVQ",
    taxesCab: ["Taxe", "Taux", "Se remet à"],
    taxes: [
      ["TPS — taxe sur les produits et services", "5 %", "Revenu Québec (pour le fédéral)"],
      ["TVQ — taxe de vente du Québec", "9,975 %", "Revenu Québec"],
    ],
    ptaxes1:
      "Les deux se calculent sur **le même montant hors taxes** et s'arrondissent **séparément**. La TVQ ne se calcule pas sur la TPS — ce n'est plus le cas depuis 2013, et c'est une erreur qu'on voit encore dans de vieux gabarits de facture.",
    ptaxes2:
      "Sur une facture elles doivent apparaître **sur deux lignes distinctes**, avec vos numéros d'inscription. Une seule ligne « taxes » ne sert ni à votre client ni à votre comptable.",
    h2resto: "Et le reste : CNESST, FSS, RRQ",
    presto:
      "Sur la paie, certaines retenues sont les mêmes pour tout le monde au Québec — le RRQ, le RQAP, l'assurance-emploi — et d'autres **dépendent de votre entreprise** :",
    resto: [
      "**L'impôt retenu à la source** vient de la table TP-1015.3-V et du TD1 que chaque personne signe. Il change d'une personne à l'autre.",
      "**La CNESST** dépend de votre unité de classification. Votre taux est sur votre avis de cotisation annuel.",
      "**Le FSS** dépend de votre masse salariale totale et de votre secteur.",
    ],
    prestoCierre:
      "Aucun logiciel ne peut deviner ces trois-là à votre place. Chez nous, elles arrivent à 0 % et attendent votre chiffre, avec une note qui dit d'où il sort — plutôt qu'un chiffre inventé qui a l'air juste.",
    descargo:
      "Ce guide explique comment les choses fonctionnent, pour vous aider à poser les bonnes questions. **Ce n'est pas un avis fiscal ni juridique.** Les taux et les règles changent — la CCQ et Revenu Québec restent la source officielle, et votre comptable reste votre comptable.",
    cierreH2: "Tout ça, préparé tout seul.",
    cierreP:
      "Les taxes calculées, la retenue gardée chantier par chantier et le rapport de la CCQ prêt le 15. Essayez-le 30 jours, sans carte.",
    cierreCta: "Commencer l'essai",
    cierreCta2: "Voir ce que ça fait",
    faq: [
      { q: "Quand faut-il transmettre le rapport mensuel de la CCQ ?", a: "Au plus tard le 15 du mois suivant, et il faut le transmettre même si aucune heure n'a été travaillée ce mois-là. Les heures se déclarent par semaine, du dimanche au samedi." },
      { q: "Combien est la retenue contractuelle en construction au Québec ?", a: "Habituellement 10 % du montant des travaux, retenue par le client et libérée à la fin selon le contrat. Les taxes se calculent sur la valeur complète des travaux : c'est le paiement qui est réduit, pas la facture." },
      { q: "Quel est le taux de la TPS et de la TVQ au Québec ?", a: "La TPS est de 5 % et la TVQ de 9,975 %. Les deux se calculent sur le même montant hors taxes et s'arrondissent séparément : la TVQ ne se calcule pas sur la TPS." },
      { q: "Faut-il déclarer le métier et la région de chaque travailleur à la CCQ ?", a: "Oui. Chaque personne se déclare avec son métier, son statut (apprenti ou compagnon), le secteur et la région, en plus des heures et du salaire. Ce sont ces éléments qui déterminent le taux prévu à la convention." },
    ],
  },
  precios: {
    meta: {
      title: "Tarifs — Logiciel Construction | Deux forfaits, travailleurs illimités",
      desc: "Chantier à 99 et Entreprise à 249 par mois : en dollars canadiens au Canada, en euros dans la zone euro. Travailleurs sur le terrain illimités dans les deux. Essai de 30 jours sans carte, mois par mois, sans contrat.",
    },
    sobretitulo: "Tarifs",
    h1: "Deux forfaits. Le prix affiché est le prix.",
    entradilla:
      "Par mois. Mois par mois, sans contrat, et sans négociation en coulisse — tout le monde paie le même prix.",
    otraMoneda: "En dollars canadiens. Dans la zone euro, le même chiffre en euros : 99 € et 249 € (TVA en sus là où elle s'applique).",
    mes: "CAD / mois",
    ano: "CAD / an",
    // La moneda en que se cobra en este idioma. Italia paga en euros, la
    // misma cifra; los demás, en dólares canadienses.
    moneda: "CAD",
    simbolo: "$",
    mensual: "Mensuel",
    anual: "Annuel",
    ahorro: "2 mois gratuits",
    destacado: "Le plus choisi",
    probar: "Essayer 30 jours",
    chantier: {
      nombre: "Chantier",
      para: "Pour celui qui s'en occupe lui-même, avec deux ou trois personnes, et dont le comptable tient déjà les livres.",
      limite: "Jusqu'à 2 personnes au bureau",
      items: [
        "Chantiers, bons de travail et horaire",
        "Pointage GPS et photos, depuis le chantier",
        "Soumissions signées sur téléphone",
        "Factures avec les taxes de votre pays",
        "Décomptes progressifs",
        "Portail client avec photos et factures",
      ],
    },
    entreprise: {
      nombre: "Entreprise",
      para: "Pour celui qui a déjà du monde à sa charge et paie quelqu'un pour mettre ses papiers en ordre chaque mois.",
      limite: "Personnes au bureau illimitées",
      items: [
        "**Tout ce qu'il y a dans Chantier**",
        "Marge par chantier, en temps réel",
        "Export pour votre comptable, et QuickBooks au Canada",
        "Québec : paies, T4 et rapport mensuel de la CCQ",
        "Rapports : qui vous doit, quel chantier fait de la marge",
        "Questions d'argent à votre assistant IA",
        "Accès limités : un contremaître qui ne voit pas le profit",
      ],
    },
    extras: [
      { t: "Dans les deux forfaits", p: "Travailleurs sur le terrain illimités. Quatre langues. Les règles de votre pays. Double vérification à la connexion." },
      { t: "L'essai", p: "30 jours, sans carte de crédit. Dans les deux premiers jours, on entre vos trois derniers chantiers avec vous." },
      { t: "Si vous partez", p: "Mois par mois, sans contrat. Vous téléchargez toutes vos données quand vous voulez, sans demander à personne." },
    ],
    compararSobre: "Comparons ce qui se compare",
    compararH2: "Ce n'est pas un logiciel de plus sur la facture.",
    compararP1:
      "Une entreprise de dix personnes paie aujourd'hui un logiciel de chantier, un autre pour facturer, et quelqu'un qui met ses heures et ses papiers en ordre chaque mois. Ce dernier est le plus cher, et ce n'est pas un logiciel : ce sont des heures.",
    compararP2:
      "On ne remplace pas votre comptable — les déclarations et la fin d'année restent les siennes. On lui enlève les heures à courir après les feuilles de temps.",
    preguntas: [
      {
        q: "Pourquoi les travailleurs sont-ils illimités ?",
        a: [
          "Parce que faire payer par tête punit exactement ce dont le système a besoin : que toute l'équipe pointe depuis le chantier.",
          "Sans les vraies heures, personne ne peut savoir si un chantier fait de l'argent — et c'est la raison d'être de l'outil. On ne vous fera pas payer pour les données qui le font fonctionner.",
        ],
      },
      {
        q: "La différence entre les deux forfaits, en une phrase ?",
        a: [
          "Chantier, c'est quand vous vous en occupez vous-même. Entreprise, c'est quand vous n'êtes plus seul.",
          "La marge par chantier, les rapports et les accès limités sont des besoins qui apparaissent le même jour : le jour où vous embauchez.",
        ],
      },
      {
        q: "J'ai deux entreprises. Vous le faites ?",
        a: [
          "Pas aujourd'hui, et on préfère le dire que le promettre. Chaque entreprise a son compte.",
          "Écrivez-nous quand même : si c'est votre cas, on veut savoir exactement ce qu'il vous faut avant de le construire.",
        ],
      },
      {
        q: "Les prix vont-ils augmenter ?",
        a: ["Le prix auquel vous entrez est celui que vous gardez. S'ils augmentent un jour, ils augmentent pour les nouveaux."],
      },
    ],
    cierreH2: "Essayez-le avec vos vrais chantiers.",
    cierreP: "30 jours, sans carte. Si ça ne vous sert pas, vous ne faites rien et ça s'arrête tout seul.",
    cierreCta: "Commencer l'essai",
  },
  paises: {
    meta: {
      title: "Votre pays — Les règles du Québec et de l'Italie, déjà faites | Logiciel Construction",
      desc: "Québec : TPS et TVQ, retenue de 10 %, rapport de la CCQ, paie et QuickBooks. Italie : TVA par chantier, facture électronique FatturaPA, SAL, congruità, virement « parlant » et DURC. Et ce qui est d'un pays ne passe pas dans un autre.",
    },
    sobretitulo: "Votre pays",
    h1: "Les règles de votre pays, déjà faites. Et seulement les vôtres.",
    entradilla:
      "Le système sait dans quel pays est votre entreprise : il calcule ses taxes, prépare ses documents et cache ce qui ne vous concerne pas. Un entrepreneur de Rome ne voit pas la CCQ, et un de Montréal ne voit pas le DURC.",
    verTodo: "Voir chaque pays",
    lista: [
      {
        nombre: "Québec · Canada",
        estado: "Disponible",
        listo: true,
        resumen: ["TPS et TVQ sur deux lignes, retenue de 10 %", "Rapport mensuel de la CCQ, prêt le 15", "Paie du Québec et T4", "Synchronisé avec QuickBooks"],
      },
      {
        nombre: "Italie",
        estado: "Disponible",
        listo: true,
        resumen: ["TVA de 22, 10 et 4 %, et autoliquidation", "XML FatturaPA validé, prêt pour le SDI", "SAL par poste et congruità de la main-d'œuvre", "Virement « parlant » et échéances du DURC"],
      },
      {
        nombre: "Votre pays ?",
        estado: "Bientôt",
        listo: false,
        resumen: ["Le chantier, le pointage, les clients et le portail fonctionnent déjà", "En français, anglais, espagnol ou italien", "Les taxes, quand elles seront complètes", "Dites-nous le vôtre et on vous avertit"],
      },
    ],
    detalle: [
      {
        t: "Québec · Canada",
        estado: "Disponible",
        listo: true,
        p: "Là où on a commencé. Tout ce qu'un entrepreneur du Québec fait chaque mois avec un tableur et une date limite.",
        enlace: "ccq",
        enlaceTexto: "Le guide : CCQ, retenue et taxes",
        items: [
          { t: "TPS et TVQ sur deux lignes", p: "5 % et 9,975 %, arrondies séparément, avec vos numéros d'inscription." },
          { t: "Retenue de 10 %", p: "Sur les travaux et non sur les taxes ; gardée chantier par chantier et libérée dans la facture finale." },
          { t: "Rapport mensuel de la CCQ", p: "Avec les heures déjà pointées, du dimanche au samedi, avec métier, statut, secteur et région. Prêt le 15." },
          { t: "Paie du Québec et T4", p: "RRQ, RQAP, assurance-emploi et parts de l'employeur, avec l'année de chaque chiffre à côté." },
          { t: "QuickBooks", p: "Clients, factures, paiements et dépenses y vont tout seuls. Ce que votre comptable change là-bas revient ici." },
          { t: "Licence RBQ", p: "Sur la soumission et la facture, là où elle doit être." },
        ],
      },
      {
        t: "Italie",
        estado: "Disponible",
        listo: true,
        p: "Ce qu'une impresa edile fait avec trois logiciels et son commercialista, en un seul.",
        items: [
          { t: "La TVA dépend du chantier", p: "22 %, 10 % pour les rénovations résidentielles, 4 % pour la première résidence, et l'autoliquidation pour la sous-traitance, avec son code N6.3." },
          { t: "Facture électronique FatturaPA", p: "Le XML de chaque facture et note de crédit, validé contre le schéma officiel. S'il manque une donnée du client, il vous dit laquelle." },
          { t: "SAL par poste", p: "Vous mesurez le % fait de chaque poste ; la différence se facture au prix du contrat et l'acompte se récupère tout seul. Avec le PDF à signer." },
          { t: "Congruità de la main-d'œuvre", p: "Les 33 catégories de la Cassa Edile. Il vous dit combien de main-d'œuvre il manque avant le solde final, pas après." },
          { t: "Bonus edilizi et virement « parlant »", p: "Le libellé exact du virement sur chaque facture et dans le portail du client, et les 11 % que retient la banque." },
          { t: "DURC, formations et examens médicaux", p: "Chaque document avec sa date, de votre équipe et de vos sous-traitants, et l'avis trente jours avant." },
          { t: "Les heures pour le consulente", p: "Normales, supplémentaires, maltempo, malattia et infortunio : le mois de chaque personne, dans un CSV." },
          { t: "Export pour le commercialista", p: "Imponibile, aliquota, TVA et natura de chaque facture, comme il les demande." },
        ],
      },
      {
        t: "Votre pays ?",
        estado: "Bientôt",
        listo: false,
        p: "La gestion de chantier ne dépend pas du pays. Les taxes, oui, et on ne vous laisse pas émettre une facture que votre comptable devrait refaire.",
        items: [
          { t: "Ce qui fonctionne déjà", p: "Chantiers, bons de travail, pointage GPS, photos, clients, soumissions signées, portail et rappels." },
          { t: "Dans votre langue", p: "Français, anglais, espagnol ou italien, chacun dans la sienne." },
          { t: "Dans votre monnaie", p: "Les montants, dans la monnaie de votre pays." },
          { t: "Dites-nous le vôtre", p: "Les pays s'activent un par un, au complet. Écrivez-nous et on vous avertit le jour où le vôtre est prêt." },
        ],
      },
    ],
    separadoSobre: "Un détail qui compte",
    separadoH2: "Ce qui est d'un pays ne passe pas dans un autre.",
    separadoP:
      "Ni à l'écran, ni dans vos documents, ni dans ce que répond votre assistant. Une entreprise du Québec ne peut pas enregistrer par erreur une donnée italienne, et une de Rome n'ouvre pas la paie du Québec. C'est verrouillé dans le système et dans la base de données, pas seulement caché dans le menu.",
    cierreH2: "Essayez-le avec les règles de votre pays.",
    cierreP: "30 jours, sans carte. Si votre pays n'y est pas encore, écrivez-nous : on veut le savoir.",
    cierreCta: "Commencer l'essai",
    cierreCta2: "Nous écrire",
  },
  capturas: {
    sobre: "Voilà de quoi ça a l'air",
    h2: "Le vrai produit, pas un dessin.",
    entradilla: "Trois écrans tels qu'ils sont aujourd'hui, avec des données d'exemple.",
    lista: [
      { t: "Le téléphone de votre équipe", p: "Sa journée, son chantier et le bouton pour pointer. Rien d'autre.", alt: "L'application terrain sur le téléphone d'un travailleur" },
      { t: "Les décomptes d'un chantier", p: "Ce qui est fait de chaque poste, ce qui se facture et l'acompte qui se déduit.", alt: "Les décomptes progressifs d'un chantier" },
      { t: "Ce que voit votre client", p: "Sa soumission, sa facture et ce qu'il doit payer, sur son téléphone.", alt: "Le portail client sur le téléphone" },
    ],
  },
  contacto: {
    meta: {
      title: "Support — Logiciel Construction",
      desc: "Un problème ? L'aide intégrée répond en deux touches, sur l'écran où vous êtes. Si elle ne règle pas votre cas, ouvrez un billet et on répond d'ici un jour ouvrable.",
    },
    sobretitulo: "Support",
    h1: "Un problème ? On répond.",
    entradilla:
      "Commencez par l'aide intégrée : elle est dans le système, elle répond en deux touches sur l'écran où vous êtes, et elle est plus rapide que nous. Si elle ne règle pas votre cas, le billet arrive ici.",
    primeroTitulo: "D'abord : l'aide intégrée",
    primeroP:
      "La barre du bas, sur tous les écrans. Elle connaît les taxes de votre pays, la retenue, les factures et la paie, et elle vous amène à l'endroit où ça se fait. Si sa réponse ne règle pas votre cas, elle ouvre un billet elle-même — avec votre entreprise et l'écran où vous étiez déjà dedans.",
    primeroCta: "Ouvrir le système",
    ventajas: [
      { t: "C'est nous qui répondons", p: "Pas un robot. On connaît le produit parce qu'on l'a écrit." },
      { t: "Dites-nous l'écran", p: "L'écran où vous étiez et ce que vous veniez de faire nous épargnent un aller-retour — et vous aussi." },
      { t: "Un jour ouvrable", p: "C'est le délai qu'on se donne. Si ça vous bloque pour facturer ou pour payer vos gars, dites-le : ça passe devant." },
    ],
    formTitulo: "Ouvrir un billet",
    formEntradilla: "Si vous ne pouvez pas entrer dans le système, c'est ici. Le dernier champ est le plus utile.",
    campoNombre: "Votre nom",
    campoEmpresa: "Votre entreprise",
    campoTelefono: "Téléphone",
    campoCorreo: "Courriel",
    campoMensaje: "Qu'est-ce qui se passe ?",
    mensajePlaceholder: "L'écran, ce que vous avez fait, et ce qui s'est passé à la place…",
    enviar: "Envoyer",
    enviando: "Envoi…",
    privacidadNota: "On vous répond en personne. Vos données servent à vous répondre, et à rien d'autre —",
    privacidadEnlace: "notre politique",
    faltan: "Il nous faut votre nom, une façon de vous répondre, et ce qui se passe.",
    enviado: "C'est reçu. On vous répond d'ici un jour ouvrable.",
    fallo: "On n'a pas réussi à l'envoyer d'ici. Ce que vous avez écrit est encore là — écrivez-nous directement et on répond pareil.",
    abrirCorreo: "Ouvrir un courriel à",
    asuntoCorreo: "Support",
  },
  legal: {
    volver: "Retour à l'accueil",
    titular: "Responsable",
  },
};
