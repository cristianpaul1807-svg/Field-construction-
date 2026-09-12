/**
 * Los textos de los correos, en los cuatro idiomas.
 *
 * Viven aquí y no en el paquete de idiomas del cliente por la misma razón que
 * los del chat público: los compone el servidor, y quien los recibe no ha
 * abierto el panel ni tiene idioma elegido. El idioma sale de quien lo manda.
 */

export type LangCorreo = "es" | "en" | "fr" | "it";

export function normalizarLangCorreo(bruto: unknown): LangCorreo {
  const v = String(bruto ?? "").slice(0, 2).toLowerCase();
  return v === "en" || v === "fr" || v === "it" || v === "es" ? v : "es";
}

interface TextosCorreo {
  /** Código de acceso al portal del cliente. */
  codigoAsunto: (negocio: string) => string;
  codigoTitulo: (negocio: string) => string;
  codigoIntro: (negocio: string) => string;
  codigoEtiqueta: string;
  codigoComoEntrar: string;
  codigoBoton: string;
  codigoQueVera: string;
  codigoCaduca: string;
  pie: (negocio: string) => string;
}

export const TEXTOS_CORREO: Record<LangCorreo, TextosCorreo> = {
  es: {
    codigoAsunto: (n) => `Tu acceso al portal de ${n}`,
    codigoTitulo: (n) => `Ya puedes seguir tu obra con ${n}`,
    codigoIntro: (n) =>
      `${n} te ha dado acceso a su portal de clientes. Ahí ves cómo va tu obra, tus presupuestos y tus facturas, sin tener que llamar.`,
    codigoEtiqueta: "Tu código de acceso",
    codigoComoEntrar: "Entra, escribe el código y ya está. No hace falta crear ninguna cuenta ni recordar contraseñas.",
    codigoBoton: "Entrar al portal",
    codigoQueVera:
      "Dentro puedes ver el avance de los trabajos, descargar tus documentos en PDF, aprobar presupuestos y escribirle directamente.",
    codigoCaduca:
      "Guarda este correo. Si pides un código nuevo, este deja de funcionar.",
    pie: (n) => `Este correo te lo envía ${n} a través de su software de gestión.`,
  },
  en: {
    codigoAsunto: (n) => `Your access to ${n}'s portal`,
    codigoTitulo: (n) => `You can now follow your project with ${n}`,
    codigoIntro: (n) =>
      `${n} has given you access to their client portal. That's where you can see how your project is going, your estimates and your invoices — without having to call.`,
    codigoEtiqueta: "Your access code",
    codigoComoEntrar: "Go in, type the code, and that's it. No account to create, no password to remember.",
    codigoBoton: "Open the portal",
    codigoQueVera:
      "Inside you can follow the work, download your documents as PDFs, approve estimates and message them directly.",
    codigoCaduca: "Keep this email. If you ask for a new code, this one stops working.",
    pie: (n) => `This email was sent to you by ${n} through their management software.`,
  },
  fr: {
    codigoAsunto: (n) => `Votre accès au portail de ${n}`,
    codigoTitulo: (n) => `Vous pouvez maintenant suivre votre chantier avec ${n}`,
    codigoIntro: (n) =>
      `${n} vous a donné accès à son portail client. Vous y voyez l'avancement de votre chantier, vos soumissions et vos factures, sans avoir à appeler.`,
    codigoEtiqueta: "Votre code d'accès",
    codigoComoEntrar: "Entrez, saisissez le code, et c'est tout. Aucun compte à créer, aucun mot de passe à retenir.",
    codigoBoton: "Ouvrir le portail",
    codigoQueVera:
      "À l'intérieur, vous suivez les travaux, téléchargez vos documents en PDF, acceptez les soumissions et écrivez directement.",
    codigoCaduca: "Gardez ce courriel. Si vous demandez un nouveau code, celui-ci cesse de fonctionner.",
    pie: (n) => `Ce courriel vous est envoyé par ${n} via son logiciel de gestion.`,
  },
  it: {
    codigoAsunto: (n) => `Il tuo accesso al portale di ${n}`,
    codigoTitulo: (n) => `Ora puoi seguire il tuo cantiere con ${n}`,
    codigoIntro: (n) =>
      `${n} ti ha dato accesso al suo portale clienti. Lì vedi come procede il cantiere, i preventivi e le fatture, senza dover telefonare.`,
    codigoEtiqueta: "Il tuo codice di accesso",
    codigoComoEntrar: "Entra, scrivi il codice, e basta. Nessun account da creare, nessuna password da ricordare.",
    codigoBoton: "Apri il portale",
    codigoQueVera:
      "Dentro puoi seguire i lavori, scaricare i documenti in PDF, accettare preventivi e scrivergli direttamente.",
    codigoCaduca: "Conserva questa email. Se chiedi un nuovo codice, questo smette di funzionare.",
    pie: (n) => `Questa email ti è inviata da ${n} tramite il suo software di gestione.`,
  },
};
