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
    precios: "tarifs",
    contacto: "contact",
    privacidad: "confidentialite",
    condiciones: "conditions",
  },
  marca: { sub: "Québec" },
  nav: {
    inicio: "Accueil",
    funciones: "Fonctionnalités",
    ccq: "CCQ et taxes",
    precios: "Tarifs",
    probar: "Essai",
    hablar: "Parlez-nous",
    entrar: "Se connecter",
    idioma: "Langue",
  },
  pie: {
    tagline: "Le logiciel de gestion des entrepreneurs en construction du Québec.",
    producto: "Le produit",
    empezar: "Commencer",
    legal: "Légal",
    ensayo: "Essai de 30 jours",
    derechos: "© 2026 Logiciel Construction",
    hecho: "Fait pour le Québec · Données hébergées au Canada",
  },
  inicio: {
    meta: {
      title: "Logiciel Construction — Gérez vos chantiers, vos gars et votre argent",
      desc: "Logiciel de gestion pour entrepreneurs en construction du Québec : soumissions, factures avec TPS et TVQ, retenue de 10 %, paie, rapport mensuel CCQ et portail client. Essai de 30 jours, sans carte.",
    },
    sobretitulo: "Fait au Québec, pour le Québec",
    h1: "Gérez vos chantiers, vos gars et votre argent. Au même endroit.",
    entradilla:
      "Soumissions, factures avec la TPS et la TVQ calculées, retenue de 10 %, paie, rapport mensuel de la CCQ et portail client. Un seul outil au lieu de quatre, plus les heures de votre comptable.",
    cta: "Essayer 30 jours — sans carte",
    cta2: "Voir ce que ça fait",
    bajo: "Travailleurs sur le terrain illimités · Mois par mois, sans contrat · Vos données restent les vôtres",
    escena: {
      gpsTitulo: "Pointage et GPS",
      gpsQuien: "Franck — 777 rue Campbell",
      gpsEstado: "Sur place",
      gpsLlegada: "Arrivée",
      nominaTitulo: "Paie — semaine du 14",
      nominaNormales: "Heures normales · 40 h",
      nominaExtra: "Heures supplémentaires · 6 h",
      nominaRetenciones: "RRQ · RQAP · AE",
      nominaNeto: "Net",
      facturaTitulo: "Facture 2026-0001",
      facturaTrabajos: "Travaux exécutés",
      facturaTps: "TPS 5 %",
      facturaTvq: "TVQ 9,975 %",
      facturaRetencion: "Retenue 10 %",
      facturaPagar: "À payer",
      integraTitulo: "Se branche à ce que vous avez déjà",
      integraTarjeta: "Paiement par carte",
      integraPie: "Vos factures, encaissements et dépenses partent vers votre comptabilité tout seuls.",
      telFecha: "Mercredi 16 septembre",
      telObra: "777 rue Campbell",
      telEnCurso: "En cours",
      telTarea: "Charpente de murs extérieurs",
      telGente: "Franck, Abel",
      telHoy: "Aujourd'hui",
      telHora: "7 h 04 → en cours",
      telFichado: "● Pointé sur place",
      telFoto: "Ajouter une photo",
    },
    cifrasSobre: "Pensé ici, pas traduit",
    cifrasH2: "Les chiffres du Québec sont dedans, pas en option.",
    cifrasEntradilla:
      "La plupart des logiciels de construction viennent des États-Unis et s'arrêtent à la frontière. Le nôtre commence ici.",
    cifras: [
      { valor: "9,975 %", etiqueta: "TVQ calculée et séparée de la TPS, comme votre comptable en a besoin." },
      { valor: "10 %", etiqueta: "de retenue, gardée chantier par chantier. De l'argent que bien du monde ne revoit jamais." },
      { valor: "Le 15", etiqueta: "votre rapport mensuel de la CCQ est prêt, semaine par semaine." },
      { valor: "Illimité", etiqueta: "travailleurs sur le terrain, sans supplément. Votre équipe ne vous coûte pas plus cher." },
    ],
    razonesSobre: "Ce que ça change",
    razonesH2: "Quatre choses, et aucune n'est technique.",
    razones: [
      {
        t: "Vous savez si vous faites de l'argent sur chaque chantier — aujourd'hui, pas en mars.",
        p: "Les heures, les matériaux et les factures entrent tout seuls. La marge de chaque chantier est à l'écran. Si un chantier mange votre profit, vous l'apprenez pendant que vous pouvez encore faire quelque chose.",
      },
      {
        t: "Vous êtes payé plus vite.",
        p: "Le client accepte la soumission depuis son téléphone, la facture part toute seule et il paie par carte. Ce qui prenait trois semaines et deux appels prend deux jours.",
      },
      {
        t: "Le lundi matin, vous ne courez plus après personne.",
        p: "Vos gars ont pointé depuis le chantier, les photos sont déjà dans le dossier des travaux, et vous savez qui est où sans appeler personne.",
      },
      {
        t: "La CCQ arrête d'être le 15 du mois.",
        p: "Le rapport se prépare avec les heures déjà saisies, semaine par semaine comme la CCQ les demande. Vous le révisez et vous le transmettez. Les pénalités montent jusqu'à 20 % — c'est cher pour une date oubliée.",
      },
    ],
    remplazaSobre: "Ce que vous payez déjà",
    remplazaH2: "Vous n'achetez pas un outil de plus. Vous en enlevez trois.",
    remplazaEntradilla:
      "Un entrepreneur de dix personnes au Québec paie aujourd'hui un logiciel de chantier, QuickBooks, et quelqu'un pour monter la paie et la CCQ chaque mois.",
    remplaza: [
      { t: "Le chantier", p: "Chantiers, bons de travail, horaire, pointage avec GPS, photos, bons de changement. Tout ce qui se passe dehors." },
      { t: "L'argent", p: "Soumissions, factures, notes de crédit, encaissements, dépenses, suivi des coûts. Avec les taxes du Québec et la retenue." },
      { t: "Le monde", p: "Paie, T4, ententes de travail, rapport de la CCQ, vacances. Les papiers de chaque personne, à une seule place." },
    ],
    idiomasSobre: "Personne d'autre ne fait ça",
    idiomasH2: "Vous en français. Vos gars dans leur langue.",
    idiomasP1:
      "Le même système, en même temps, en français, en anglais, en espagnol et en italien. Le chef de chantier lit son bon de travail dans sa langue, et vous lisez le vôtre dans la vôtre.",
    idiomasP2:
      "Sur un chantier au Québec, ce n'est pas un détail : c'est la différence entre une consigne comprise et une consigne devinée.",
    ejemploTarea: "Charpente de murs extérieurs",
    preguntasSobre: "Les questions qui reviennent",
    preguntasH2: "Avant que vous les posiez.",
    preguntas: [
      {
        q: "Est-ce que ça remplace mon comptable ?",
        a: [
          "Non, et il faut le dire franchement. La conciliation bancaire, les déclarations de TPS et de TVQ et la fin d'année restent à lui.",
          "Ce qu'on lui enlève, c'est courir après les heures et monter le rapport de la CCQ à la main. Vous lui payez moins d'heures, pour le travail qui en vaut vraiment la peine.",
        ],
      },
      {
        q: "Est-ce que vous transmettez le rapport à la CCQ ?",
        a: [
          "Non. On vous le prépare, prêt à transmettre, avec les heures déjà saisies et découpées du dimanche au samedi comme la CCQ les demande. C'est vous qui le déposez sur le site de la CCQ.",
          "La CCQ ne publie pas de format pour l'envoyer par système. Le jour où elle le fera, on le fera.",
        ],
      },
      {
        q: "Combien ça coûte d'ajouter un gars sur le terrain ?",
        a: [
          "Rien. Les travailleurs entrent avec leur code dans l'application du terrain, et ils sont illimités dans tous les forfaits.",
          "C'est volontaire : facturer par tête punit exactement ce dont le système a besoin pour fonctionner, soit que toute l'équipe pointe.",
        ],
      },
      {
        q: "Et si je veux partir ?",
        a: [
          "Mois par mois, sans contrat. Vous partez quand vous voulez.",
          "Et vos données sont les vôtres : vous les exportez au complet, quand vous voulez, sans avoir à le demander à personne.",
        ],
      },
      {
        q: "Ça marche sur le chantier, sans réseau ?",
        a: [
          "L'application du terrain s'installe sur le téléphone comme n'importe quelle autre et elle est faite pour être utilisée avec une main sale et une barre de réseau.",
          "Le pointage, les photos et les bons de travail sont ce que vos gars touchent — le reste du système n'est pas sur leur téléphone, et c'est voulu.",
        ],
      },
    ],
    cierreH2: "Essayez-le avec vos vrais chantiers.",
    cierreP:
      "30 jours, sans carte de crédit. Dans les deux premiers jours, on entre vos trois derniers chantiers avec vous — pour que vous le voyiez avec vos affaires et pas avec des exemples inventés.",
    cierreCta: "Commencer l'essai",
    cierreCta2: "Voir les tarifs",
  },
  funciones: {
    meta: {
      title: "Fonctionnalités — Chantiers, soumissions, paie et CCQ | Logiciel Construction",
      desc: "Pointage GPS, photos de chantier, bons de travail, soumissions signées du téléphone, factures avec TPS et TVQ, retenue de 10 %, paie, rapport CCQ, marge par chantier et portail client.",
    },
    sobretitulo: "Fonctionnalités",
    h1: "Quatre morceaux de votre journée, dans le même outil.",
    entradilla:
      "Rien ici n'est une case à cocher sur une liste. Chaque chose existe parce qu'un entrepreneur du Québec la fait déjà, à la main, tous les mois.",
    bloques: [
      {
        icono: "chantier",
        t: "Le chantier",
        p: "Ce qui se passe dehors, sur le téléphone de vos gars. Ils installent l'application, entrent avec un code, et c'est tout ce qu'ils voient.",
        items: [
          { t: "Pointage avec GPS", p: "Arrivée et départ depuis le chantier, avec l'endroit. Les 8 heures et les heures supplémentaires se séparent toutes seules." },
          { t: "Photos qui se classent seules", p: "Prises sur place, elles arrivent directement dans le dossier des travaux. Plus de photos perdues dans une conversation." },
          { t: "Bons de travail et horaire", p: "Qui va où, quand, et pour faire quoi. Dans la langue de la personne." },
          { t: "Bons de changement", p: "Ce qui s'ajoute en cours de route, écrit, chiffré et approuvé. La moitié des chicanes de fin de chantier viennent de là." },
          { t: "Vacances et absences", p: "Demandées du téléphone, approuvées par vous, visibles dans l'horaire." },
        ],
      },
      {
        icono: "clientes",
        t: "Les clients",
        p: "Un client qui voit l'avancement appelle moins. Et un entrepreneur qui répond vite a l'air d'une entreprise deux fois plus grosse quand il soumissionne.",
        items: [
          { t: "Soumissions acceptées du téléphone", p: "Il ouvre, il lit, il accepte. Avec la date et la trace de qui a accepté." },
          { t: "Portail client", p: "Ses photos, son avancement, ses factures. À votre marque à vous, pas à la nôtre." },
          { t: "Un lien public pour les demandes", p: "À mettre dans votre bio Instagram ou votre message d'accueil WhatsApp. Ce qui rentre par là devient une fiche client, pas un message perdu." },
          { t: "Toutes les conversations à une place", p: "Ce que le client a demandé et quand, sans chercher dans trois applications." },
        ],
      },
      {
        icono: "dinero",
        t: "L'argent",
        p: "Les taxes du Québec, la retenue, et la seule question qui compte vraiment : est-ce que ce chantier-là fait de l'argent ?",
        items: [
          { t: "TPS et TVQ sur deux lignes", p: "5 % et 9,975 %, arrondies séparément, avec vos numéros d'inscription. Comme votre comptable en a besoin." },
          { t: "Retenue de 10 %", p: "Calculée sur les travaux, gardée chantier par chantier, avec le rappel de la réclamer à la fin." },
          { t: "Paiement par carte", p: "Le client paie depuis sa facture. L'argent va dans votre compte, pas dans le nôtre." },
          { t: "Marge par chantier, en temps réel", p: "Ce qui est dépensé, ce qui est facturé, ce qui reste. Aujourd'hui, pas en mars." },
          { t: "Notes de crédit", p: "Une facture transmise ne se modifie pas : elle se corrige avec une note de crédit, comme il se doit." },
          { t: "Branché à QuickBooks", p: "Clients, factures, encaissements et dépenses partent tout seuls. Ce que votre comptable change là-bas revient ici." },
        ],
      },
      {
        icono: "cumplimiento",
        t: "La conformité",
        p: "La partie que personne n'aime et que tout le monde doit faire. C'est là qu'on se distingue des logiciels venus d'ailleurs.",
        items: [
          { t: "Rapport mensuel de la CCQ", p: "Avec les heures déjà pointées, du dimanche au samedi, avec le métier, le statut, le secteur et la région de chaque personne. Prêt le 15.", enlace: "ccq", enlaceTexto: "Comment ça marche" },
          { t: "Paie du Québec", p: "RRQ, RQAP, assurance-emploi et les parts de l'employeur, avec l'année de chaque chiffre écrite à côté pour que ce soit vérifiable." },
          { t: "Ententes de travail et T4", p: "Le métier, le statut et le taux de chaque personne pour chaque période. Ce qui était vrai en mars reste vrai dans le rapport de mars." },
          { t: "Licence RBQ sur vos documents", p: "Sur la soumission et sur la facture, où elle doit être." },
        ],
      },
    ],
    noSobre: "Et ce qu'on ne fait pas",
    noH2: "On aime mieux vous le dire avant.",
    no: [
      { t: "On ne transmet pas à la CCQ", p: "On prépare le rapport. Vous le déposez sur le site de la CCQ. Elle ne publie pas de format d'envoi par système." },
      { t: "On ne remplace pas votre comptable", p: "La conciliation bancaire, les déclarations de TPS et de TVQ et la fin d'année restent à lui." },
      { t: "Pas encore plusieurs entreprises", p: "Chaque entreprise a son compte. Si c'est votre cas, écrivez-nous : on veut savoir ce qu'il vous faut avant de le bâtir." },
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
      desc: "Chantier à 99 $ et Entreprise à 249 $ par mois, en dollars canadiens. Travailleurs sur le terrain illimités dans les deux. Essai de 30 jours sans carte, mois par mois, sans contrat.",
    },
    sobretitulo: "Tarifs",
    h1: "Deux forfaits. Le prix affiché est le prix.",
    entradilla:
      "En dollars canadiens, par mois, taxes en sus. Mois par mois, sans contrat. Pas de négociation par en dessous : tout le monde paie la même chose.",
    mes: "CAD / mois",
    destacado: "Le plus choisi",
    probar: "Essayer 30 jours",
    chantier: {
      nombre: "Chantier",
      para: "Pour celui qui mène ça lui-même, avec deux ou trois personnes, et dont le comptable tient déjà les livres.",
      limite: "Jusqu'à 2 personnes au bureau",
      items: [
        "Chantiers, bons de travail et horaire",
        "Pointage avec GPS et photos, depuis le chantier",
        "Soumissions signées depuis le téléphone",
        "Factures avec TPS et TVQ, et retenue de 10 %",
        "Paiement par carte",
        "Portail client avec photos et factures",
      ],
    },
    entreprise: {
      nombre: "Entreprise",
      para: "Pour celui qui a déjà du monde sur la paie et qui paie quelqu'un pour monter les papiers chaque mois.",
      limite: "Personnes au bureau sans limite",
      items: [
        "**Tout ce qu'il y a dans Chantier**",
        "Paie, T4 et ententes de travail",
        "Rapport mensuel de la CCQ, prêt le 15",
        "Marge par chantier, en temps réel",
        "Comptabilité branchée à QuickBooks",
        "Rapports : qui vous doit, quel chantier paie",
        "Accès limités : un chef de chantier qui ne voit pas le profit",
      ],
    },
    extras: [
      { t: "Dans les deux forfaits", p: "Travailleurs sur le terrain illimités. Français, anglais, espagnol et italien. Double vérification à l'entrée. Accès limités par section." },
      { t: "L'essai", p: "30 jours, sans carte de crédit. Dans les deux premiers jours, on entre vos trois derniers chantiers avec vous." },
      { t: "Si vous partez", p: "Mois par mois, sans contrat. Vous exportez toutes vos données quand vous voulez, sans le demander à personne." },
    ],
    compararSobre: "Comparons ce qui se compare",
    compararH2: "Ce n'est pas un logiciel de plus sur la facture.",
    compararP1:
      "Un entrepreneur de dix personnes au Québec paie aujourd'hui un logiciel de chantier, QuickBooks, et quelqu'un qui monte la paie et le rapport de la CCQ chaque mois. C'est ce dernier qui coûte le plus cher, et ce n'est pas un logiciel : c'est des heures.",
    compararP2:
      "On ne remplace pas votre comptable — la conciliation, les déclarations et la fin d'année restent à lui. On lui enlève les heures à courir après des feuilles de temps.",
    preguntas: [
      {
        q: "Pourquoi les travailleurs sont-ils illimités ?",
        a: [
          "Parce que facturer par tête punit exactement ce dont le système a besoin : que toute l'équipe pointe depuis le chantier.",
          "Sans les heures réelles, personne ne peut savoir si un chantier fait de l'argent — et c'est la raison d'être de l'outil. On ne va pas vous charger pour les données qui le font marcher.",
        ],
      },
      {
        q: "Quelle est la différence entre les deux forfaits, en une phrase ?",
        a: [
          "Chantier, c'est pour quand vous menez ça vous-même. Entreprise, c'est pour quand vous n'êtes plus seul.",
          "La paie, la CCQ et les accès limités sont tous des besoins qui apparaissent le même jour : celui où vous engagez.",
        ],
      },
      {
        q: "J'ai deux entreprises. Vous faites ça ?",
        a: [
          "Pas aujourd'hui, et on préfère le dire que de le promettre. Chaque entreprise a son compte.",
          "Écrivez-nous quand même : si c'est votre cas, on veut savoir exactement ce dont vous avez besoin avant de le construire.",
        ],
      },
      {
        q: "Les prix vont-ils monter ?",
        a: ["Le prix auquel vous entrez est celui que vous gardez. Si les tarifs montent un jour, ils montent pour les nouveaux."],
      },
    ],
    cierreH2: "Essayez-le avec vos vrais chantiers.",
    cierreP: "30 jours, sans carte. Si ça ne vous sert pas, vous ne faites rien et ça s'arrête tout seul.",
    cierreCta: "Commencer l'essai",
  },
  contacto: {
    meta: {
      title: "Essai de 30 jours — Logiciel Construction",
      desc: "Commencez un essai de 30 jours sans carte de crédit. On entre vos trois derniers chantiers avec vous dans les deux premiers jours.",
    },
    sobretitulo: "Essai de 30 jours",
    h1: "Voyez-le avec vos vrais chantiers.",
    entradilla:
      "Laissez-nous votre numéro. On vous rappelle, et dans les deux premiers jours on entre vos trois derniers chantiers avec vous — pour que vous le voyiez avec vos affaires et pas avec des exemples inventés.",
    ventajas: [
      { t: "Sans carte de crédit", p: "Rien à annuler. Si ça ne vous sert pas, vous ne faites rien et ça s'arrête." },
      { t: "30 jours, pas 14", p: "Parce que ce qui convainc arrive à la fin du mois : la paie, la CCQ, fermer les factures, voir la marge du chantier terminé." },
      { t: "On parle votre langue", p: "En français, en anglais, en espagnol ou en italien." },
    ],
    formTitulo: "Écrivez-nous",
    formEntradilla: "Quatre champs. On n'en demande pas plus que ce qu'il faut pour vous rappeler.",
    campoNombre: "Votre nom",
    campoEmpresa: "Votre entreprise",
    campoTelefono: "Téléphone",
    campoCorreo: "Courriel",
    campoGente: "Combien de travailleurs ?",
    campoGenteElegir: "Choisir…",
    gente: ["Juste moi", "2 à 5", "6 à 15", "16 à 30", "Plus de 30"],
    campoMensaje: "Quelque chose à ajouter ?",
    opcional: "(optionnel)",
    mensajePlaceholder: "Ce qui vous prend le plus de temps en ce moment…",
    enviar: "Demander l'essai",
    enviando: "Envoi…",
    privacidadNota: "On vous répond en personne, pas par un robot. Vos données servent à vous rappeler, et à rien d'autre —",
    privacidadEnlace: "notre politique",
    faltan: "Il nous faut votre nom et une façon de vous répondre — téléphone ou courriel.",
    enviado: "C'est reçu. On vous rappelle d'ici un jour ouvrable.",
    fallo: "On n'a pas réussi à l'envoyer d'ici. Vos réponses sont encore là — écrivez-nous directement et on vous répond pareil.",
    abrirCorreo: "Ouvrir un courriel à",
    asuntoCorreo: "Demande d'essai",
  },
  legal: {
    volver: "Retour à l'accueil",
    titular: "Responsable",
  },
};
