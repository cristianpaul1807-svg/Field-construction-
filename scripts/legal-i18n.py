# -*- coding: utf-8 -*-
"""Los textos legales, en los cuatro idiomas y a la vez.

Se ejecuta desde la raíz del repositorio:

    python3 scripts/legal-i18n.py

Se generan desde aquí para que las cuatro versiones tengan exactamente las
mismas secciones y los mismos párrafos. Escritas a mano en cuatro archivos,
la francesa acaba diciendo algo que la castellana no dice — y en un documento
legal eso no es una errata, es otra promesa.
"""
import json, collections, io

TITULAR = "Christhian Paul Rodriguez Almarales"
DIRECCION = "Via Damiano Chiesa 1, 43036 Fidenza, Italia"
CORREO = "progetmanagement@gmail.com"
ACTUALIZADO = "2026-09-15"

# Cada sección: (id, {idioma: (titulo, [parrafos])})
PRIVACIDAD = [
    ("quien", {
        "es": ("Quién responde de tus datos", [
            f"**{TITULAR}**, persona física, con domicilio en {DIRECCION}. No hay sociedad detrás: respondo yo.",
            f"Para cualquier cosa relacionada con tus datos —saber qué tengo, corregirlo, llevártelo o borrarlo— escribe a **{CORREO}**. Contesto yo, no un formulario.",
        ]),
        "en": ("Who is responsible for your data", [
            f"**{TITULAR}**, a natural person, at {DIRECCION}. There is no company behind this: I answer for it myself.",
            f"For anything about your data — knowing what I hold, correcting it, taking it with you or deleting it — write to **{CORREO}**. I answer, not a form.",
        ]),
        "fr": ("Qui répond de vos données", [
            f"**{TITULAR}**, personne physique, domicilié au {DIRECCION}. Il n'y a pas de société derrière : j'en réponds moi-même.",
            f"Pour tout ce qui touche à vos données — savoir ce que je détiens, le corriger, l'emporter ou l'effacer — écrivez à **{CORREO}**. C'est moi qui réponds, pas un formulaire.",
        ]),
        "it": ("Chi risponde dei tuoi dati", [
            f"**{TITULAR}**, persona fisica, con domicilio in {DIRECCION}. Non c'è una società dietro: ne rispondo io.",
            f"Per qualsiasi cosa riguardi i tuoi dati — sapere cosa ho, correggerlo, portartelo via o cancellarlo — scrivi a **{CORREO}**. Rispondo io, non un modulo.",
        ]),
    }),
    ("que", {
        "es": ("Qué datos hay aquí dentro", [
            "**Del negocio que contrata el servicio:** nombre, dirección, teléfono, correo, número de licencia y números de impuestos. Se imprimen en cada presupuesto y cada factura que emite, porque la ley de Quebec lo exige.",
            "**De sus clientes:** nombre, teléfono, correo y dirección de la obra. Los mete el contratista, no nosotros.",
            "**De sus trabajadores y subcontratistas:** nombre, teléfono, oficio, tarifa por hora, horas fichadas y —cuando ficha con el móvil— la posición GPS del momento del fichaje. Si el contratista lo sube, también documentos suyos como el contrato o el T4.",
            "**De lo que se factura y se cobra:** importes, impuestos, fechas y medio de pago.",
        ]),
        "en": ("What data is in here", [
            "**About the business using the service:** name, address, phone, email, licence number and tax numbers. These print on every estimate and invoice it issues, because Quebec law requires them.",
            "**About its clients:** name, phone, email and job address. The contractor enters these, not us.",
            "**About its workers and subcontractors:** name, phone, trade, hourly rate, logged hours and — when clocking in from the phone — the GPS position at that moment. If the contractor uploads them, also their own documents such as a contract or a T4.",
            "**About what is invoiced and collected:** amounts, taxes, dates and payment method.",
        ]),
        "fr": ("Quelles données se trouvent ici", [
            "**De l'entreprise qui utilise le service :** nom, adresse, téléphone, courriel, numéro de licence et numéros de taxes. Ils s'impriment sur chaque soumission et chaque facture qu'elle émet, parce que la loi québécoise l'exige.",
            "**De ses clients :** nom, téléphone, courriel et adresse du chantier. C'est l'entrepreneur qui les saisit, pas nous.",
            "**De ses travailleurs et sous-traitants :** nom, téléphone, métier, taux horaire, heures pointées et — au pointage depuis le téléphone — la position GPS à ce moment-là. Si l'entrepreneur les téléverse, aussi ses documents comme le contrat ou le T4.",
            "**De ce qui est facturé et encaissé :** montants, taxes, dates et mode de paiement.",
        ]),
        "it": ("Quali dati ci sono qui dentro", [
            "**Dell'impresa che usa il servizio:** nome, indirizzo, telefono, email, numero di licenza e numeri fiscali. Vengono stampati su ogni preventivo e ogni fattura che emette, perché la legge del Québec lo impone.",
            "**Dei suoi clienti:** nome, telefono, email e indirizzo del cantiere. Li inserisce l'impresa, non noi.",
            "**Dei suoi lavoratori e subappaltatori:** nome, telefono, mestiere, tariffa oraria, ore timbrate e — timbrando dal telefono — la posizione GPS di quel momento. Se l'impresa li carica, anche i suoi documenti come il contratto o il T4.",
            "**Di quanto si fattura e si incassa:** importi, imposte, date e mezzo di pagamento.",
        ]),
    }),
    ("paraque", {
        "es": ("Para qué se usan", [
            "Para que el programa funcione, y para nada más. No se venden, no se alquilan, no se usan para publicidad y no se usan para entrenar ningún modelo.",
            "La posición GPS se guarda **sólo en el momento del fichaje**, para poder decir desde dónde se fichó. No hay seguimiento continuo: la aplicación no sabe dónde está nadie entre un fichaje y otro.",
            "El trabajador no ve nunca lo que gana otro, ni su tarifa. Lo que gana cada uno es entre esa persona y la oficina.",
        ]),
        "en": ("What they are used for", [
            "To make the software work, and nothing else. They are not sold, not rented, not used for advertising and not used to train any model.",
            "GPS position is stored **only at the moment of clocking in or out**, so it can be said where the punch happened. There is no continuous tracking: the app does not know where anyone is between punches.",
            "A worker never sees another worker's pay or rate. What each person earns is between them and the office.",
        ]),
        "fr": ("À quoi elles servent", [
            "À faire fonctionner le logiciel, et à rien d'autre. Elles ne sont ni vendues, ni louées, ni utilisées pour de la publicité, ni utilisées pour entraîner un modèle.",
            "La position GPS n'est enregistrée **qu'au moment du pointage**, afin de pouvoir dire d'où il a été fait. Il n'y a aucun suivi continu : l'application ne sait pas où se trouve qui que ce soit entre deux pointages.",
            "Un travailleur ne voit jamais la paie ni le taux d'un autre. Ce que chacun gagne regarde cette personne et le bureau.",
        ]),
        "it": ("A cosa servono", [
            "A far funzionare il programma, e a nient'altro. Non si vendono, non si affittano, non si usano per pubblicità e non si usano per addestrare nessun modello.",
            "La posizione GPS si registra **solo al momento della timbratura**, per poter dire da dove è stata fatta. Non c'è tracciamento continuo: l'app non sa dove si trovi nessuno fra una timbratura e l'altra.",
            "Un lavoratore non vede mai la paga né la tariffa di un altro. Quello che ognuno guadagna riguarda quella persona e l'ufficio.",
        ]),
    }),
    ("donde", {
        "es": ("Dónde están", [
            "**En Canadá.** La base de datos y los archivos están alojados en Supabase, en su región de Montreal (`ca-central-1`). Los datos de un contratista quebequés y de sus trabajadores no salen del país.",
            "Que yo esté en Italia no cambia eso: administro el sistema desde aquí, pero los datos siguen allí.",
        ]),
        "en": ("Where they are", [
            "**In Canada.** The database and the files are hosted on Supabase, in its Montreal region (`ca-central-1`). The data of a Quebec contractor and their workers does not leave the country.",
            "My being in Italy does not change that: I administer the system from here, but the data stays there.",
        ]),
        "fr": ("Où elles se trouvent", [
            "**Au Canada.** La base de données et les fichiers sont hébergés chez Supabase, dans sa région de Montréal (`ca-central-1`). Les données d'un entrepreneur québécois et de ses travailleurs ne quittent pas le pays.",
            "Le fait que je sois en Italie n'y change rien : j'administre le système depuis ici, mais les données restent là-bas.",
        ]),
        "it": ("Dove si trovano", [
            "**In Canada.** Il database e i file sono ospitati su Supabase, nella sua regione di Montréal (`ca-central-1`). I dati di un'impresa del Québec e dei suoi lavoratori non escono dal paese.",
            "Che io stia in Italia non cambia questo: amministro il sistema da qui, ma i dati restano là.",
        ]),
    }),
    ("terceros", {
        "es": ("Quién más los ve", [
            "Sólo estos, y sólo lo que cada uno necesita:",
            "**Supabase** — guarda la base de datos y los archivos. Montreal, Canadá.",
            "**Stripe** — procesa los pagos con tarjeta. Recibe el importe y los datos del pagador; la tarjeta no pasa nunca por nuestro servidor.",
            "**Intuit (QuickBooks)** — sólo si el contratista conecta su contabilidad. Entonces recibe sus clientes, facturas, cobros y gastos, que es exactamente lo que va a su libro.",
            "**Resend** — envía los correos del sistema. Recibe la dirección y el contenido del correo.",
            "**OpenStreetMap** — dibuja los mapas y convierte una dirección en coordenadas. Recibe la dirección que se está buscando.",
            "Ninguno de ellos recibe nada para sus propios fines.",
        ]),
        "en": ("Who else sees them", [
            "Only these, and only what each one needs:",
            "**Supabase** — holds the database and the files. Montreal, Canada.",
            "**Stripe** — processes card payments. It receives the amount and the payer's details; the card never passes through our server.",
            "**Intuit (QuickBooks)** — only if the contractor connects their accounting. It then receives their clients, invoices, payments and expenses, which is exactly what goes in their books.",
            "**Resend** — sends the system's emails. It receives the address and the content.",
            "**OpenStreetMap** — draws the maps and turns an address into coordinates. It receives the address being looked up.",
            "None of them receives anything for their own purposes.",
        ]),
        "fr": ("Qui d'autre les voit", [
            "Seulement ceux-ci, et seulement ce dont chacun a besoin :",
            "**Supabase** — conserve la base de données et les fichiers. Montréal, Canada.",
            "**Stripe** — traite les paiements par carte. Il reçoit le montant et les coordonnées du payeur ; la carte ne passe jamais par notre serveur.",
            "**Intuit (QuickBooks)** — uniquement si l'entrepreneur branche sa comptabilité. Il reçoit alors ses clients, factures, paiements et dépenses, c'est-à-dire exactement ce qui va dans ses livres.",
            "**Resend** — envoie les courriels du système. Il reçoit l'adresse et le contenu.",
            "**OpenStreetMap** — dessine les cartes et convertit une adresse en coordonnées. Il reçoit l'adresse recherchée.",
            "Aucun d'eux ne reçoit quoi que ce soit pour ses propres fins.",
        ]),
        "it": ("Chi altro li vede", [
            "Solo questi, e solo quello che a ciascuno serve:",
            "**Supabase** — conserva il database e i file. Montréal, Canada.",
            "**Stripe** — elabora i pagamenti con carta. Riceve l'importo e i dati di chi paga; la carta non passa mai dal nostro server.",
            "**Intuit (QuickBooks)** — solo se l'impresa collega la sua contabilità. Riceve allora i suoi clienti, fatture, incassi e spese, cioè esattamente quello che va nei suoi libri.",
            "**Resend** — invia le email del sistema. Riceve l'indirizzo e il contenuto.",
            "**OpenStreetMap** — disegna le mappe e trasforma un indirizzo in coordinate. Riceve l'indirizzo cercato.",
            "Nessuno di loro riceve nulla per i propri scopi.",
        ]),
    }),
    ("cuanto", {
        "es": ("Cuánto tiempo se guardan", [
            "Mientras el negocio use el servicio. Si deja de usarlo y me lo pide, borro todo lo suyo.",
            "Con una excepción que no es nuestra: **las facturas emitidas no se borran** mientras la ley obligue a conservarlas. En Canadá son seis años. Por eso, cuando un cliente pide que le borren sus datos y tiene facturas, el sistema se niega y lo dice — escríbeme y lo resolvemos sin romper la contabilidad de nadie.",
        ]),
        "en": ("How long they are kept", [
            "For as long as the business uses the service. If it stops and asks me, I delete everything of theirs.",
            "With one exception that is not ours to make: **issued invoices are not deleted** while the law requires them to be kept. In Canada that is six years. That is why, when a client asks to have their data deleted and they have invoices, the system refuses and says so — write to me and we resolve it without breaking anyone's accounting.",
        ]),
        "fr": ("Combien de temps elles sont conservées", [
            "Tant que l'entreprise utilise le service. Si elle cesse et me le demande, j'efface tout ce qui lui appartient.",
            "Avec une exception qui ne vient pas de nous : **les factures émises ne s'effacent pas** tant que la loi oblige à les conserver. Au Canada, c'est six ans. C'est pourquoi, quand un client demande l'effacement de ses données et qu'il a des factures, le système refuse et le dit — écrivez-moi et on règle ça sans casser la comptabilité de personne.",
        ]),
        "it": ("Per quanto tempo si conservano", [
            "Finché l'impresa usa il servizio. Se smette e me lo chiede, cancello tutto il suo.",
            "Con un'eccezione che non dipende da noi: **le fatture emesse non si cancellano** finché la legge obbliga a conservarle. In Canada sono sei anni. Per questo, quando un cliente chiede di cancellare i suoi dati e ha fatture, il sistema rifiuta e lo dice — scrivimi e lo risolviamo senza rompere la contabilità di nessuno.",
        ]),
    }),
    ("derechos", {
        "es": ("Tus derechos", [
            f"Puedes pedir **ver** lo que hay sobre ti, **corregirlo**, **llevártelo** en un archivo, **borrarlo** u **oponerte** a que se use. Escribe a {CORREO} y contesto en un mes como máximo — normalmente en días.",
            "Si eres trabajador de una empresa que usa esto, empieza por tu oficina: los datos son suyos y ellos los meten. Si no te contestan, escríbeme igual.",
            "Si crees que no lo he hecho bien, puedes reclamar a la **Commission d'accès à l'information du Québec** si estás en Quebec, o al **Garante per la protezione dei dati personali** en Italia.",
        ]),
        "en": ("Your rights", [
            f"You can ask to **see** what exists about you, **correct** it, **take it with you** as a file, **delete** it, or **object** to its use. Write to {CORREO} and I answer within a month at most — usually within days.",
            "If you are a worker at a company that uses this, start with your office: the data is theirs and they enter it. If they don't answer you, write to me anyway.",
            "If you think I have not handled it properly, you can complain to the **Commission d'accès à l'information du Québec** if you are in Quebec, or to the **Garante per la protezione dei dati personali** in Italy.",
        ]),
        "fr": ("Vos droits", [
            f"Vous pouvez demander à **voir** ce qui existe à votre sujet, à le **corriger**, à l'**emporter** dans un fichier, à l'**effacer** ou à vous **opposer** à son utilisation. Écrivez à {CORREO} et je réponds dans un mois au plus — normalement en quelques jours.",
            "Si vous êtes travailleur dans une entreprise qui utilise ceci, commencez par votre bureau : les données sont les siennes et c'est lui qui les saisit. S'il ne vous répond pas, écrivez-moi quand même.",
            "Si vous estimez que je m'y suis mal pris, vous pouvez porter plainte auprès de la **Commission d'accès à l'information du Québec** si vous êtes au Québec, ou du **Garante per la protezione dei dati personali** en Italie.",
        ]),
        "it": ("I tuoi diritti", [
            f"Puoi chiedere di **vedere** quello che esiste su di te, **correggerlo**, **portartelo via** in un file, **cancellarlo** oppure **opporti** al suo uso. Scrivi a {CORREO} e rispondo entro un mese al massimo — di solito in pochi giorni.",
            "Se sei un lavoratore di un'impresa che usa questo, parti dal tuo ufficio: i dati sono suoi ed è lui che li inserisce. Se non ti rispondono, scrivimi lo stesso.",
            "Se pensi che non me ne sia occupato bene, puoi reclamare alla **Commission d'accès à l'information du Québec** se sei in Québec, o al **Garante per la protezione dei dati personali** in Italia.",
        ]),
    }),
    ("navegador", {
        "es": ("Lo que se guarda en tu navegador", [
            "Tu sesión, el idioma que elegiste y un par de preferencias de pantalla. Nada más.",
            "**No hay cookies de publicidad ni de seguimiento**, ni nuestras ni de nadie. Por eso tampoco verás un cartel de cookies: no hay nada que consentir.",
        ]),
        "en": ("What is stored in your browser", [
            "Your session, the language you picked and a couple of screen preferences. Nothing else.",
            "**There are no advertising or tracking cookies**, ours or anyone's. That is also why you will not see a cookie banner: there is nothing to consent to.",
        ]),
        "fr": ("Ce qui est gardé dans votre navigateur", [
            "Votre session, la langue que vous avez choisie et deux ou trois préférences d'affichage. Rien d'autre.",
            "**Il n'y a aucun témoin publicitaire ni de suivi**, ni les nôtres ni ceux de qui que ce soit. C'est aussi pour ça que vous ne verrez pas de bandeau de témoins : il n'y a rien à consentir.",
        ]),
        "it": ("Cosa si conserva nel tuo browser", [
            "La tua sessione, la lingua che hai scelto e un paio di preferenze di schermo. Nient'altro.",
            "**Non ci sono cookie pubblicitari né di tracciamento**, né nostri né di nessuno. Per questo non vedrai nemmeno un banner dei cookie: non c'è nulla da acconsentire.",
        ]),
    }),
    ("cambios", {
        "es": ("Si esto cambia", [
            "Cambiará: el producto es joven. Cuando cambie algo que importe, lo aviso por correo al negocio antes de que entre en vigor, y la fecha de arriba se actualiza.",
            "El día que haya una sociedad detrás en vez de una persona, también se dirá aquí.",
        ]),
        "en": ("If this changes", [
            "It will: the product is young. When something that matters changes, I tell the business by email before it takes effect, and the date above is updated.",
            "The day there is a company behind this instead of a person, that will be said here too.",
        ]),
        "fr": ("Si ceci change", [
            "Ça changera : le produit est jeune. Quand quelque chose d'important change, je préviens l'entreprise par courriel avant que ça prenne effet, et la date ci-dessus est mise à jour.",
            "Le jour où il y aura une société derrière plutôt qu'une personne, ce sera dit ici aussi.",
        ]),
        "it": ("Se questo cambia", [
            "Cambierà: il prodotto è giovane. Quando cambia qualcosa che conta, lo comunico via email all'impresa prima che entri in vigore, e la data qui sopra viene aggiornata.",
            "Il giorno in cui ci sarà una società dietro invece di una persona, si dirà anche questo qui.",
        ]),
    }),
]

CONDICIONES = [
    ("que", {
        "es": ("Qué es esto", [
            "Un programa de gestión para empresas de construcción: presupuestos, obras, horas, facturas, cobros y la contabilidad que sale de ahí.",
            f"Lo ofrece **{TITULAR}**, persona física, {DIRECCION}. Contacto: {CORREO}.",
        ]),
        "en": ("What this is", [
            "Management software for construction businesses: estimates, jobs, hours, invoices, payments and the bookkeeping that comes out of them.",
            f"It is offered by **{TITULAR}**, a natural person, {DIRECCION}. Contact: {CORREO}.",
        ]),
        "fr": ("Ce que c'est", [
            "Un logiciel de gestion pour entreprises de construction : soumissions, chantiers, heures, factures, encaissements et la comptabilité qui en découle.",
            f"Il est offert par **{TITULAR}**, personne physique, {DIRECCION}. Contact : {CORREO}.",
        ]),
        "it": ("Che cos'è", [
            "Un programma di gestione per imprese edili: preventivi, cantieri, ore, fatture, incassi e la contabilità che ne esce.",
            f"Lo offre **{TITULAR}**, persona fisica, {DIRECCION}. Contatto: {CORREO}.",
        ]),
    }),
    ("noesasesoria", {
        "es": ("Lo que no es", [
            "**No es asesoría fiscal, contable ni legal.** El programa calcula impuestos y retenciones con las tasas publicadas y produce documentos con la forma que exige Quebec, pero no presenta ninguna declaración ante ningún organismo y no sustituye a un contable ni a un abogado.",
            "Las tasas cambian cada enero y la configuración de cada negocio decide lo que sale impreso. **Revisa las cifras antes de usarlas en serio.** Quien firma una declaración es quien responde de ella.",
            "Los contratos y acuerdos que genera son documentos de gestión interna. No sustituyen un contrato revisado por un abogado.",
        ]),
        "en": ("What it is not", [
            "**It is not tax, accounting or legal advice.** The software calculates taxes and deductions using published rates and produces documents in the form Quebec requires, but it files nothing with any authority and replaces neither an accountant nor a lawyer.",
            "Rates change every January and each business's own settings decide what gets printed. **Check the figures before relying on them.** Whoever signs a return is the one answerable for it.",
            "The contracts and agreements it generates are internal management documents. They do not replace a contract reviewed by a lawyer.",
        ]),
        "fr": ("Ce que ce n'est pas", [
            "**Ce n'est pas un conseil fiscal, comptable ni juridique.** Le logiciel calcule les taxes et les retenues avec les taux publiés et produit des documents dans la forme qu'exige le Québec, mais il ne transmet aucune déclaration à aucun organisme et ne remplace ni un comptable ni un avocat.",
            "Les taux changent chaque janvier et la configuration de chaque entreprise décide de ce qui s'imprime. **Vérifiez les chiffres avant de vous en servir pour de vrai.** Celui qui signe une déclaration en répond.",
            "Les contrats et ententes qu'il génère sont des documents de gestion interne. Ils ne remplacent pas un contrat révisé par un avocat.",
        ]),
        "it": ("Cosa non è", [
            "**Non è consulenza fiscale, contabile né legale.** Il programma calcola imposte e ritenute con le aliquote pubblicate e produce documenti nella forma che il Québec richiede, ma non presenta nessuna dichiarazione a nessun ente e non sostituisce né un commercialista né un avvocato.",
            "Le aliquote cambiano ogni gennaio e la configurazione di ogni impresa decide cosa viene stampato. **Controlla le cifre prima di usarle sul serio.** Chi firma una dichiarazione ne risponde.",
            "I contratti e gli accordi che genera sono documenti di gestione interna. Non sostituiscono un contratto rivisto da un avvocato.",
        ]),
    }),
    ("tuscosas", {
        "es": ("Lo que metes es tuyo", [
            "Tus clientes, tus presupuestos, tus facturas y tus documentos siguen siendo tuyos. No los uso para nada que no sea hacer funcionar el servicio, y puedes llevártelos cuando quieras: las tablas se exportan a Excel y a PDF desde el propio programa.",
            "Tú respondes de que tienes derecho a meter los datos que metes —los de tus clientes y los de tu gente— y de avisarles de que los tratas aquí.",
        ]),
        "en": ("What you put in is yours", [
            "Your clients, your estimates, your invoices and your documents remain yours. I do not use them for anything other than running the service, and you can take them with you whenever you want: the tables export to Excel and PDF from within the software.",
            "You are responsible for having the right to enter the data you enter — your clients' and your people's — and for telling them it is handled here.",
        ]),
        "fr": ("Ce que vous y mettez est à vous", [
            "Vos clients, vos soumissions, vos factures et vos documents restent les vôtres. Je ne m'en sers pour rien d'autre que faire fonctionner le service, et vous pouvez les emporter quand vous voulez : les tableaux s'exportent en Excel et en PDF depuis le logiciel même.",
            "Il vous revient d'avoir le droit de saisir les données que vous saisissez — celles de vos clients et de vos gens — et de les avertir qu'elles sont traitées ici.",
        ]),
        "it": ("Quello che inserisci è tuo", [
            "I tuoi clienti, i tuoi preventivi, le tue fatture e i tuoi documenti restano tuoi. Non li uso per nulla che non sia far funzionare il servizio, e puoi portarteli via quando vuoi: le tabelle si esportano in Excel e in PDF dal programma stesso.",
            "Sta a te avere il diritto di inserire i dati che inserisci — quelli dei tuoi clienti e della tua gente — e di avvisarli che vengono trattati qui.",
        ]),
    }),
    ("pagos", {
        "es": ("Los cobros a tus clientes", [
            "Si activas los pagos con tarjeta, el dinero va **directamente a tu propia cuenta de Stripe**, no a la mía. La relación de pago es entre Stripe y tú, con sus condiciones y sus comisiones.",
            "La comisión que Stripe se queda de cada cobro se apunta en la factura para que la veas, con el impuesto que lleva encima separado.",
        ]),
        "en": ("Collecting from your clients", [
            "If you turn on card payments, the money goes **straight to your own Stripe account**, not to mine. The payment relationship is between Stripe and you, under their terms and their fees.",
            "The fee Stripe keeps from each payment is recorded on the invoice so you can see it, with the tax on top of it shown separately.",
        ]),
        "fr": ("Les encaissements auprès de vos clients", [
            "Si vous activez les paiements par carte, l'argent va **directement dans votre propre compte Stripe**, pas dans le mien. La relation de paiement est entre Stripe et vous, selon leurs conditions et leurs frais.",
            "Les frais que Stripe retient sur chaque encaissement sont inscrits sur la facture pour que vous les voyiez, avec la taxe qui s'y ajoute indiquée à part.",
        ]),
        "it": ("Gli incassi dai tuoi clienti", [
            "Se attivi i pagamenti con carta, il denaro va **direttamente sul tuo conto Stripe**, non sul mio. Il rapporto di pagamento è fra Stripe e te, con le loro condizioni e le loro commissioni.",
            "La commissione che Stripe trattiene su ogni incasso viene annotata sulla fattura perché tu la veda, con l'imposta che ci sta sopra indicata a parte.",
        ]),
    }),
    ("disponibilidad", {
        "es": ("Disponibilidad y fallos", [
            "Hago lo posible por que esté siempre en pie, pero no prometo un porcentaje de disponibilidad ni compenso caídas. Es un producto joven con un solo desarrollador: prefiero decírtelo a escribir una garantía que no podría sostener.",
            "Si algo falla, el propio programa te lo dice en tu idioma y te ofrece escribir a soporte. Contesto yo.",
        ]),
        "en": ("Availability and failures", [
            "I do what I can to keep it up, but I promise no uptime percentage and compensate no outages. This is a young product with a single developer: I would rather tell you that than write a guarantee I could not keep.",
            "If something fails, the software itself tells you in your language and offers to write to support. I am the one who answers.",
        ]),
        "fr": ("Disponibilité et pannes", [
            "Je fais ce que je peux pour que ça reste debout, mais je ne promets aucun pourcentage de disponibilité et je ne compense aucune panne. C'est un produit jeune avec un seul développeur : je préfère vous le dire plutôt qu'écrire une garantie que je ne pourrais pas tenir.",
            "Si quelque chose échoue, le logiciel vous le dit lui-même dans votre langue et vous propose d'écrire au soutien. C'est moi qui réponds.",
        ]),
        "it": ("Disponibilità e guasti", [
            "Faccio il possibile perché resti in piedi, ma non prometto nessuna percentuale di disponibilità e non risarcisco interruzioni. È un prodotto giovane con un solo sviluppatore: preferisco dirtelo piuttosto che scrivere una garanzia che non potrei mantenere.",
            "Se qualcosa non va, il programma stesso te lo dice nella tua lingua e ti offre di scrivere all'assistenza. Rispondo io.",
        ]),
    }),
    ("terminar", {
        "es": ("Dejar de usarlo", [
            "Cuando quieras y sin dar explicaciones. Exporta lo tuyo antes, y dímelo para que borre lo que quede.",
            "Por mi parte, sólo cortaría el acceso a quien use esto para algo ilegal, o a quien intente romperlo o entrar en los datos de otro negocio. Avisando antes, salvo que avisar sea justo lo que no toca.",
        ]),
        "en": ("Stopping", [
            "Whenever you want and without explaining yourself. Export what is yours first, and tell me so I delete what is left.",
            "On my side, I would only cut off access to someone using this for something illegal, or trying to break it or reach another business's data. With notice, unless notice is precisely the wrong thing to give.",
        ]),
        "fr": ("Arrêter de l'utiliser", [
            "Quand vous voulez et sans vous justifier. Exportez ce qui est à vous avant, et dites-le-moi pour que j'efface ce qui reste.",
            "De mon côté, je ne couperais l'accès qu'à quelqu'un qui s'en sert pour quelque chose d'illégal, ou qui tente de le casser ou d'entrer dans les données d'une autre entreprise. En prévenant, sauf si prévenir est justement ce qu'il ne faut pas faire.",
        ]),
        "it": ("Smettere di usarlo", [
            "Quando vuoi e senza spiegazioni. Esporta il tuo prima, e dimmelo così cancello quello che resta.",
            "Da parte mia, toglierei l'accesso solo a chi lo usi per qualcosa di illegale, o a chi provi a romperlo o a entrare nei dati di un'altra impresa. Avvisando prima, salvo che avvisare sia proprio quello che non va fatto.",
        ]),
    }),
    ("ley", {
        "es": ("Ley aplicable", [
            "Rige la ley italiana, por ser donde está el titular. Si usas el servicio como consumidor, eso no te quita la protección que te dé la ley de tu propio país.",
            "Para lo que se factura y se declara en Quebec manda, evidentemente, la ley de Quebec — y el programa está hecho para cumplirla.",
        ]),
        "en": ("Governing law", [
            "Italian law applies, that being where the provider is. If you use the service as a consumer, this does not remove the protection your own country's law gives you.",
            "For what is invoiced and declared in Quebec, Quebec law obviously governs — and the software is built to comply with it.",
        ]),
        "fr": ("Droit applicable", [
            "Le droit italien s'applique, puisque c'est là que se trouve le fournisseur. Si vous utilisez le service comme consommateur, cela ne vous retire pas la protection que vous donne le droit de votre propre pays.",
            "Pour ce qui est facturé et déclaré au Québec, c'est évidemment le droit québécois qui régit — et le logiciel est fait pour le respecter.",
        ]),
        "it": ("Legge applicabile", [
            "Si applica la legge italiana, essendo dove si trova il titolare. Se usi il servizio come consumatore, questo non ti toglie la protezione che ti dà la legge del tuo paese.",
            "Per quello che si fattura e si dichiara in Québec vale ovviamente la legge del Québec — e il programma è fatto per rispettarla.",
        ]),
    }),
]


def bloque(secciones, idioma):
    return [
        collections.OrderedDict(
            [("id", sid), ("title", textos[idioma][0]), ("body", textos[idioma][1])]
        )
        for sid, textos in secciones
    ]


CABECERA = {
    "es": {"privacyTitle": "Política de privacidad", "termsTitle": "Condiciones de uso",
           "updated": "Actualizado el {{date}}", "back": "Volver",
           "privacyLead": "Qué datos hay aquí, quién los ve y qué puedes exigir sobre ellos. Escrito para leerse, no para cubrirme.",
           "termsLead": "Qué es este programa, qué no es, y qué esperamos el uno del otro."},
    "en": {"privacyTitle": "Privacy policy", "termsTitle": "Terms of use",
           "updated": "Updated {{date}}", "back": "Back",
           "privacyLead": "What data is here, who sees it and what you can demand about it. Written to be read, not to cover me.",
           "termsLead": "What this software is, what it is not, and what we expect of each other."},
    "fr": {"privacyTitle": "Politique de confidentialité", "termsTitle": "Conditions d'utilisation",
           "updated": "Mis à jour le {{date}}", "back": "Retour",
           "privacyLead": "Quelles données se trouvent ici, qui les voit et ce que vous pouvez exiger à leur sujet. Écrit pour être lu, pas pour me couvrir.",
           "termsLead": "Ce qu'est ce logiciel, ce qu'il n'est pas, et ce qu'on attend l'un de l'autre."},
    "it": {"privacyTitle": "Informativa sulla privacy", "termsTitle": "Condizioni d'uso",
           "updated": "Aggiornato il {{date}}", "back": "Indietro",
           "privacyLead": "Quali dati ci sono qui, chi li vede e cosa puoi pretendere su di essi. Scritto per essere letto, non per coprirmi.",
           "termsLead": "Cos'è questo programma, cosa non è, e cosa ci aspettiamo l'uno dall'altro."},
}

# La frase de la pantalla de alta. Vive aquí porque es lo que la persona
# acepta al crear la cuenta: si se escribiera suelta en los archivos de
# idioma, la próxima regeneración se la llevaría por delante.
ALTA = {
    "es": "Al crear la cuenta aceptas las condiciones de uso y la política de privacidad.",
    "en": "By creating an account you accept the terms of use and the privacy policy.",
    "fr": "En créant un compte, vous acceptez les conditions d'utilisation et la politique de confidentialité.",
    "it": "Creando l'account accetti le condizioni d'uso e l'informativa sulla privacy.",
}

for idioma in ("es", "en", "fr", "it"):
    ruta = "client/src/i18n/locales/%s.json" % idioma
    d = json.load(io.open(ruta, encoding="utf-8"), object_pairs_hook=collections.OrderedDict)
    # Se reescribe entero a propósito: este archivo es la única versión
    # buena del texto, así que volver a generarlo tiene que dejar los
    # cuatro idiomas exactamente como dice aquí, no fusionar lo anterior.
    d["legal"] = collections.OrderedDict(
        [
            ("updatedOn", ACTUALIZADO),
            ("holder", TITULAR),
            ("address", DIRECCION),
            ("email", CORREO),
        ]
        + list(CABECERA[idioma].items())
        + [
            ("signupNotice", ALTA[idioma]),
            ("privacy", bloque(PRIVACIDAD, idioma)),
            ("terms", bloque(CONDICIONES, idioma)),
        ]
    )
    with io.open(ruta, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("ok", idioma, len(PRIVACIDAD), "+", len(CONDICIONES), "secciones")
