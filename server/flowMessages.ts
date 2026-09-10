// Bot copy for the public button-flow, in every language the app supports.
// This lives server-side (not in the client's i18n bundle) because each of
// these strings is persisted as a real chat_messages row the moment its step
// is reached — the transcript keeps whatever language the visitor was using
// when the message was written, exactly like a human conversation would.

export type FlowLang = "es" | "en" | "fr" | "it";

const FALLBACK_LANG: FlowLang = "es";

export function normalizeFlowLang(raw: unknown): FlowLang {
  const value = String(raw ?? "").slice(0, 2).toLowerCase();
  return value === "en" || value === "fr" || value === "it" || value === "es" ? value : FALLBACK_LANG;
}

interface FlowCopy {
  welcome: (businessName: string) => string;
  selectService: string;
  describeProject: string;
  address: string;
  name: string;
  phone: string;
  email: string;
  summaryHeader: string;
  summaryService: string;
  summaryProject: string;
  summaryAddress: string;
  summaryName: string;
  summaryPhone: string;
  summaryEmail: string;
  summaryConfirm: string;
  otherService: string;
  done: (name: string, businessName: string) => string;
  startButton: string;
  otherOption: string;
  sendButton: string;
  describePlaceholder: string;
  addressPlaceholder: string;
  namePlaceholder: string;
  phonePlaceholder: string;
  emailPlaceholder: string;
  /** Cuando lo escrito no puede ser un correo o un teléfono: el contratista
   *  recibiría un aviso al que no puede contestar. */
  retryEmail: string;
  retryPhone: string;
  accountReady: (email: string) => string;
  appointmentSummary: (when: string, reason: string | null) => string;
}

export const FLOW_COPY: Record<FlowLang, FlowCopy> = {
  es: {
    welcome: (b) => `¡Hola! Soy el asistente de ${b}. Te haré unas preguntas rápidas para preparar tu solicitud de presupuesto.`,
    selectService: "¿Qué tipo de servicio necesitas?",
    describeProject: "Cuéntanos brevemente qué te gustaría hacer.",
    address: "¿Cuál es la dirección del proyecto?",
    name: "¿Cómo te llamas?",
    phone: "¿Cuál es tu número de teléfono?",
    email: "¿Cuál es tu correo electrónico?",
    summaryHeader: "Revisemos tu solicitud:",
    summaryService: "Servicio",
    summaryProject: "Proyecto",
    summaryAddress: "Dirección",
    summaryName: "Nombre",
    summaryPhone: "Teléfono",
    summaryEmail: "Correo",
    summaryConfirm: "¿Confirmas que la enviemos?",
    otherService: "Otro",
    done: (n, b) => `¡Listo${n ? `, ${n}` : ""}! Recibimos tu solicitud. ${b} la revisará y te enviará un presupuesto pronto.`,
    startButton: "Empezar",
    otherOption: "Otro / no estoy seguro",
    sendButton: "Enviar solicitud",
    describePlaceholder: "Escribe aquí una descripción breve del proyecto...",
    addressPlaceholder: "Escribe aquí la dirección del proyecto...",
    namePlaceholder: "Escribe aquí tu nombre...",
    phonePlaceholder: "Escribe aquí tu teléfono...",
    emailPlaceholder: "Escribe aquí tu correo electrónico...",
    retryEmail: "Eso no parece un correo electrónico. Escríbelo otra vez, por favor — es por donde te enviaremos el presupuesto.",
    retryPhone: "Eso no parece un número de teléfono. Escríbelo otra vez, por favor.",
    accountReady: (e) =>
      `¡Tu presupuesto está listo! Ya puedes seguir todo desde la app: inicia sesión como Cliente con ${e}, y usa "¿Olvidaste tu contraseña?" para crear la tuya propia.`,
    appointmentSummary: (w, r) => `Solicitó una cita — ${w}${r ? `: ${r}` : ""}`,
  },
  en: {
    welcome: (b) => `Hi! I'm ${b}'s assistant. I'll ask you a few quick questions to prepare your estimate request.`,
    selectService: "What kind of service do you need?",
    describeProject: "Tell us briefly what you'd like to have done.",
    address: "What's the project address?",
    name: "What's your name?",
    phone: "What's your phone number?",
    email: "What's your email address?",
    summaryHeader: "Let's review your request:",
    summaryService: "Service",
    summaryProject: "Project",
    summaryAddress: "Address",
    summaryName: "Name",
    summaryPhone: "Phone",
    summaryEmail: "Email",
    summaryConfirm: "Shall we send it?",
    otherService: "Other",
    done: (n, b) => `All set${n ? `, ${n}` : ""}! We've got your request. ${b} will review it and send you an estimate soon.`,
    startButton: "Get started",
    otherOption: "Other / not sure",
    sendButton: "Send request",
    describePlaceholder: "Type a short description of the project here...",
    addressPlaceholder: "Type the project address here...",
    namePlaceholder: "Type your name here...",
    phonePlaceholder: "Type your phone number here...",
    emailPlaceholder: "Type your email address here...",
    retryEmail: "That doesn't look like an email address. Please type it again — it's where we'll send your estimate.",
    retryPhone: "That doesn't look like a phone number. Please type it again.",
    accountReady: (e) =>
      `Your estimate is ready! You can now follow everything in the app: sign in as a Client with ${e}, and use "Forgot your password?" to set your own.`,
    appointmentSummary: (w, r) => `Requested an appointment — ${w}${r ? `: ${r}` : ""}`,
  },
  fr: {
    welcome: (b) => `Bonjour ! Je suis l'assistant de ${b}. Je vais vous poser quelques questions rapides pour préparer votre demande de soumission.`,
    selectService: "De quel type de service avez-vous besoin ?",
    describeProject: "Dites-nous brièvement ce que vous aimeriez faire réaliser.",
    address: "Quelle est l'adresse du projet ?",
    name: "Comment vous appelez-vous ?",
    phone: "Quel est votre numéro de téléphone ?",
    email: "Quelle est votre adresse courriel ?",
    summaryHeader: "Récapitulons votre demande :",
    summaryService: "Service",
    summaryProject: "Projet",
    summaryAddress: "Adresse",
    summaryName: "Nom",
    summaryPhone: "Téléphone",
    summaryEmail: "Courriel",
    summaryConfirm: "On l'envoie ?",
    otherService: "Autre",
    done: (n, b) => `C'est fait${n ? `, ${n}` : ""} ! Nous avons bien reçu votre demande. ${b} l'examinera et vous enverra une soumission sous peu.`,
    startButton: "Commencer",
    otherOption: "Autre / je ne sais pas",
    sendButton: "Envoyer la demande",
    describePlaceholder: "Écrivez ici une brève description du projet...",
    addressPlaceholder: "Écrivez ici l'adresse du projet...",
    namePlaceholder: "Écrivez ici votre nom...",
    phonePlaceholder: "Écrivez ici votre téléphone...",
    emailPlaceholder: "Écrivez ici votre adresse courriel...",
    retryEmail: "Cela ne ressemble pas à une adresse courriel. Réécrivez-la, s'il vous plaît — c'est là que nous enverrons votre soumission.",
    retryPhone: "Cela ne ressemble pas à un numéro de téléphone. Réécrivez-le, s'il vous plaît.",
    accountReady: (e) =>
      `Votre soumission est prête ! Vous pouvez maintenant tout suivre dans l'application : connectez-vous comme Client avec ${e}, et utilisez « Mot de passe oublié ? » pour créer le vôtre.`,
    appointmentSummary: (w, r) => `A demandé un rendez-vous — ${w}${r ? ` : ${r}` : ""}`,
  },
  it: {
    welcome: (b) => `Ciao! Sono l'assistente di ${b}. Ti farò qualche domanda veloce per preparare la tua richiesta di preventivo.`,
    selectService: "Di che tipo di servizio hai bisogno?",
    describeProject: "Raccontaci brevemente cosa vorresti fare.",
    address: "Qual è l'indirizzo del progetto?",
    name: "Come ti chiami?",
    phone: "Qual è il tuo numero di telefono?",
    email: "Qual è la tua email?",
    summaryHeader: "Rivediamo la tua richiesta:",
    summaryService: "Servizio",
    summaryProject: "Progetto",
    summaryAddress: "Indirizzo",
    summaryName: "Nome",
    summaryPhone: "Telefono",
    summaryEmail: "Email",
    summaryConfirm: "Confermi che la inviamo?",
    otherService: "Altro",
    done: (n, b) => `Fatto${n ? `, ${n}` : ""}! Abbiamo ricevuto la tua richiesta. ${b} la esaminerà e ti invierà presto un preventivo.`,
    startButton: "Iniziamo",
    otherOption: "Altro / non sono sicuro",
    sendButton: "Invia richiesta",
    describePlaceholder: "Scrivi qui una breve descrizione del progetto...",
    addressPlaceholder: "Scrivi qui l'indirizzo del progetto...",
    namePlaceholder: "Scrivi qui il tuo nome...",
    phonePlaceholder: "Scrivi qui il tuo telefono...",
    emailPlaceholder: "Scrivi qui la tua email...",
    retryEmail: "Non sembra un indirizzo email. Riscrivilo, per favore — è lì che ti manderemo il preventivo.",
    retryPhone: "Non sembra un numero di telefono. Riscrivilo, per favore.",
    accountReady: (e) =>
      `Il tuo preventivo è pronto! Ora puoi seguire tutto dall'app: accedi come Cliente con ${e}, e usa "Password dimenticata?" per crearne una tua.`,
    appointmentSummary: (w, r) => `Ha richiesto un appuntamento — ${w}${r ? `: ${r}` : ""}`,
  },
};

export function flowCopy(lang: unknown): FlowCopy {
  return FLOW_COPY[normalizeFlowLang(lang)];
}

/**
 * Un mensaje del bot guardado como lo que es: una clave y sus datos.
 *
 * Antes se guardaba el texto ya traducido, y el resultado era una conversación
 * a trozos — el saludo en italiano, la pregunta siguiente en castellano y la
 * de después en inglés, según en qué idioma estuviera el visitante en cada
 * momento. Un humano cambiando de idioma a media frase tendría sentido; una
 * máquina, no: parece rota.
 *
 * Así que se guarda la clave, como se guardan los estados, y se traduce al
 * pintarla. Cambiar de idioma reescribe la conversación entera. Lo único que
 * no se toca es lo que el cliente escribió con sus manos, que se guarda tal
 * cual y se enseña tal cual.
 *
 * Efecto secundario bueno: el contratista lee la misma conversación en SU
 * idioma, no en el del visitante.
 */
export interface FlowMessageRef {
  k: string;
  p?: Record<string, string | null>;
}

/** El texto guardado de un mensaje de bot. Es JSON, y se reconoce por serlo. */
export function flowMessageContent(k: string, p?: Record<string, string | null>): string {
  return JSON.stringify(p && Object.keys(p).length ? { k, p } : { k });
}

/** Lo contrario: null cuando el contenido es texto de una persona. */
export function parseFlowMessage(content: string): FlowMessageRef | null {
  if (!content || content[0] !== "{") return null;
  try {
    const v = JSON.parse(content);
    return v && typeof v.k === "string" ? { k: v.k, p: v.p ?? {} } : null;
  } catch {
    return null;
  }
}

/**
 * La clave, pintada en un idioma. Devuelve el contenido tal cual si la clave
 * no se reconoce: una conversación vieja, guardada como texto plano, se sigue
 * leyendo igual en vez de convertirse en un jeroglífico.
 */
export function renderFlowMessage(content: string, lang: unknown): string {
  const ref = parseFlowMessage(content);
  if (!ref) return content;
  const c = flowCopy(lang);
  const p = ref.p ?? {};
  switch (ref.k) {
    case "welcome":
      return c.welcome(p.business ?? "");
    case "done":
      return c.done(p.name ?? "", p.business ?? "");
    case "accountReady":
      return c.accountReady(p.email ?? "");
    case "appointmentSummary":
      return c.appointmentSummary(p.when ?? "", p.reason ?? null);
    case "summary":
      return [
        c.summaryHeader,
        `• ${c.summaryService}: ${p.serviceOther ? c.otherService : p.service ?? "-"}`,
        `• ${c.summaryProject}: ${p.description || "-"}`,
        `• ${c.summaryAddress}: ${p.address || "-"}`,
        `• ${c.summaryName}: ${p.name || "-"}`,
        `• ${c.summaryPhone}: ${p.phone || "-"}`,
        `• ${c.summaryEmail}: ${p.email || "-"}`,
        c.summaryConfirm,
      ].join("\n");
    // Las respuestas por botón del visitante: se guardan por lo que son, no
    // por cómo estaban escritas en ese momento.
    case "startButton":
      return c.startButton;
    case "otherOption":
      return c.otherOption;
    case "sendButton":
      return c.sendButton;
    default: {
      const directo = (c as unknown as Record<string, unknown>)[ref.k];
      return typeof directo === "string" ? directo : content;
    }
  }
}
