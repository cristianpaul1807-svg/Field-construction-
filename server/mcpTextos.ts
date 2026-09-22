/**
 * Los textos de la pantalla de consentimiento del MCP, en los cuatro idiomas.
 *
 * Viven aquí y no en el paquete de idiomas del cliente por la misma razón que
 * los de los correos: esta pantalla la pinta el servidor en HTML suelto, fuera
 * de React y de i18next, y quien la abre **no ha entrado al panel** — viene
 * desde Claude, sin sesión y sin idioma elegido.
 *
 * Que estuviera fuera de i18next es justo lo que hizo que se quedara en
 * castellano fijo mientras el resto del producto estaba en cuatro idiomas: no
 * hay `t()` que falte, no hay clave que descuadre, y ningún guardia de los que
 * hay la miraba. Y es la **única** pantalla donde alguien escribe su
 * contraseña — pedirle la contraseña a un carpintero de Quebec en español es
 * la peor pantalla posible para ahorrarse una traducción, aparte de lo que
 * dice la Loi 96.
 */

export type LangMcp = "es" | "en" | "fr" | "it";

export const IDIOMAS_MCP: { codigo: LangMcp; nombre: string }[] = [
  { codigo: "fr", nombre: "Français" },
  { codigo: "en", nombre: "English" },
  { codigo: "es", nombre: "Español" },
  { codigo: "it", nombre: "Italiano" },
];

/**
 * El idioma de quien abre la pantalla.
 *
 * Por orden: lo que haya elegido a mano, lo que pida su navegador, y si no,
 * francés — que es el idioma del mercado y el que manda la ley allí. El resto
 * del servidor decide igual (ver `normalizeDocLang`).
 */
export function langDelMcp(elegido: unknown, cabecera: string | undefined): LangMcp {
  const aMano = String(elegido ?? "").slice(0, 2).toLowerCase();
  if (aMano === "es" || aMano === "en" || aMano === "fr" || aMano === "it") return aMano;

  // `Accept-Language` llega como «fr-CA,fr;q=0.9,en;q=0.8». Se mira en orden y
  // se coge el primero que sepamos hablar, sin pelearse con los pesos: quien
  // pone el francés delante quiere francés.
  for (const trozo of (cabecera ?? "").split(",")) {
    const codigo = trozo.trim().slice(0, 2).toLowerCase();
    if (codigo === "es" || codigo === "en" || codigo === "fr" || codigo === "it") return codigo;
  }
  return "fr";
}

interface TextosMcp {
  titulo: string;
  /** El nombre de quien pide conectarse lo pone Claude, no nosotros. */
  intro: (cliente: string) => string;
  alcance: string;
  trabajadorEtiqueta: string;
  trabajadorPista: string;
  propietarioEmail: string;
  propietarioClave: string;
  propietarioPista: string;
  boton: string;
  conectando: string;
  esperando: string;
  faltanDatos: string;
  idioma: string;
}

export const TEXTOS_MCP: Record<LangMcp, TextosMcp> = {
  fr: {
    titulo: "Connecter Logiciel Construction",
    intro: (cliente) => `<strong>${cliente}</strong> demande à se connecter à votre compte Logiciel Construction.`,
    alcance: "Les autorisations et les accès exacts dépendront de votre rôle et de votre forfait, une fois connecté.",
    trabajadorEtiqueta: "Code d'accès du travailleur",
    trabajadorPista: "À utiliser pour connecter un travailleur ou un sous-traitant.",
    propietarioEmail: "Courriel du compte propriétaire",
    propietarioClave: "Mot de passe du compte propriétaire",
    propietarioPista: "Vérifié uniquement auprès de Supabase Auth ; le mot de passe n'est pas conservé.",
    boton: "Connecter à Claude",
    conectando: "Connexion…",
    esperando: "Demande envoyée. En attente de la réponse de Logiciel Construction…",
    faltanDatos: "Saisissez le code du travailleur, ou bien le courriel et le mot de passe du propriétaire.",
    idioma: "Langue",
  },
  en: {
    titulo: "Connect Logiciel Construction",
    intro: (cliente) => `<strong>${cliente}</strong> is asking to connect to your Logiciel Construction account.`,
    alcance: "Exact permissions and access depend on your role and plan once you sign in.",
    trabajadorEtiqueta: "Worker access code",
    trabajadorPista: "Use this to connect a worker or a subcontractor.",
    propietarioEmail: "Owner account email",
    propietarioClave: "Owner account password",
    propietarioPista: "Only checked against Supabase Auth; the password is not stored.",
    boton: "Connect to Claude",
    conectando: "Connecting…",
    esperando: "Request sent. Waiting for Logiciel Construction to answer…",
    faltanDatos: "Enter the worker code, or else the owner's email and password.",
    idioma: "Language",
  },
  es: {
    titulo: "Conectar Logiciel Construction",
    intro: (cliente) => `<strong>${cliente}</strong> solicita conectarse con tu cuenta de Logiciel Construction.`,
    alcance: "Los permisos y accesos exactos dependerán de tu rol y plan asignado una vez inicies sesión.",
    trabajadorEtiqueta: "Código de acceso de trabajador",
    trabajadorPista: "Úsalo para conectar un trabajador o subcontratista.",
    propietarioEmail: "Email de la cuenta propietaria",
    propietarioClave: "Contraseña de la cuenta propietaria",
    propietarioPista: "Solo se valida contra Supabase Auth; no se guarda la contraseña.",
    boton: "Conectar con Claude",
    conectando: "Conectando…",
    esperando: "Solicitud enviada. Esperando respuesta de Logiciel Construction…",
    faltanDatos: "Introduce el código del trabajador o, alternativamente, el email y la contraseña del propietario.",
    idioma: "Idioma",
  },
  it: {
    titulo: "Collega Logiciel Construction",
    intro: (cliente) => `<strong>${cliente}</strong> chiede di collegarsi al tuo account Logiciel Construction.`,
    alcance: "I permessi e gli accessi esatti dipenderanno dal tuo ruolo e dal tuo piano, una volta effettuato l'accesso.",
    trabajadorEtiqueta: "Codice di accesso del lavoratore",
    trabajadorPista: "Usalo per collegare un lavoratore o un subappaltatore.",
    propietarioEmail: "Email dell'account proprietario",
    propietarioClave: "Password dell'account proprietario",
    propietarioPista: "Viene solo verificata con Supabase Auth; la password non viene conservata.",
    boton: "Collega a Claude",
    conectando: "Connessione…",
    esperando: "Richiesta inviata. In attesa della risposta di Logiciel Construction…",
    faltanDatos: "Inserisci il codice del lavoratore, oppure l'email e la password del proprietario.",
    idioma: "Lingua",
  },
};

/**
 * Los avisos que la pantalla enseña cuando algo sale mal.
 *
 * Aparte de los textos de arriba porque los manda el servidor desde otro sitio
 * y por un código, no por una frase: así el que decide qué ha pasado no tiene
 * que saber en qué idioma está leyendo quien lo ve.
 */
export const AVISOS_MCP: Record<string, Record<LangMcp, string>> = {
  credenciales_no_validas: {
    fr: "Ces identifiants ne correspondent à aucun compte.",
    en: "Those credentials don't match any account.",
    es: "Esas credenciales no corresponden a ninguna cuenta.",
    it: "Queste credenziali non corrispondono a nessun account.",
  },
  acceso_bloqueado: {
    fr: "L'accès de l'entreprise est suspendu. Ouvrez Abonnement dans le panneau pour le réactiver.",
    en: "This business's access is suspended. Open Subscription in the panel to reactivate it.",
    es: "El acceso del negocio está bloqueado. Abre Suscripción en el panel para reactivarlo.",
    it: "L'accesso dell'azienda è sospeso. Apri Abbonamento nel pannello per riattivarlo.",
  },
  no_responde: {
    fr: "Logiciel Construction n'a pas répondu à temps. Réessayez dans un instant.",
    en: "Logiciel Construction didn't answer in time. Try again in a moment.",
    es: "Logiciel Construction no respondió a tiempo. Vuelve a intentarlo en un momento.",
    it: "Logiciel Construction non ha risposto in tempo. Riprova tra poco.",
  },
};

export function aviso(codigo: string, lang: LangMcp): string {
  return AVISOS_MCP[codigo]?.[lang] ?? AVISOS_MCP.no_responde[lang];
}
