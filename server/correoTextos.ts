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
  /** Recuperar la contraseña del panel. */
  claveAsunto: string;
  claveTitulo: string;
  claveIntro: string;
  claveEtiqueta: string;
  claveCaduca: string;
  claveNoFuiYo: string;

  /** Código de acceso al portal del cliente. */
  codigoAsunto: (negocio: string) => string;
  codigoTitulo: (negocio: string) => string;
  codigoIntro: (negocio: string) => string;
  codigoEtiqueta: string;
  codigoComoEntrar: string;
  codigoBoton: string;
  codigoQueVera: string;
  codigoCaduca: string;

  /** El presupuesto que el contratista acaba de mandar. */
  presuAsunto: (negocio: string) => string;
  presuTitulo: string;
  presuIntro: (negocio: string) => string;
  presuTotal: string;
  presuAdjunto: string;
  presuBoton: string;
  presuValidez: (dias: number) => string;

  /** La factura recién emitida. */
  facturaAsunto: (numero: string, negocio: string) => string;
  facturaTitulo: (numero: string) => string;
  facturaIntro: (negocio: string) => string;
  facturaImporte: string;
  facturaVence: (fecha: string) => string;
  facturaBoton: string;
  facturaRetencion: string;

  pie: (negocio: string) => string;
  /** El pie de los correos que manda la plataforma, no un negocio. */
  piePlataforma: string;
}

export const TEXTOS_CORREO: Record<LangCorreo, TextosCorreo> = {
  es: {
    claveAsunto: "Cambia tu contraseña",
    claveTitulo: "Cambia tu contraseña",
    claveIntro: "Has pedido entrar de nuevo. Escribe este código en la pantalla que tienes abierta y elige una contraseña nueva.",
    claveEtiqueta: "Tu código",
    claveCaduca: "El código vale durante una hora.",
    claveNoFuiYo: "Si no has sido tú, no hace falta que hagas nada: sin este código nadie puede cambiar tu contraseña.",
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
    presuAsunto: (n) => `Tu presupuesto de ${n}`,
    presuTitulo: "Tu presupuesto ya está listo",
    presuIntro: (n) => `${n} te ha preparado este presupuesto. Léelo con calma y dinos si te encaja.`,
    presuTotal: "Total",
    presuAdjunto: "Lo tienes entero en el PDF adjunto, con el desglose y las condiciones.",
    presuBoton: "Verlo y aceptarlo",
    presuValidez: (d) => `El precio se mantiene ${d} días.`,
    facturaAsunto: (num, n) => `Factura ${num} de ${n}`,
    facturaTitulo: (num) => `Factura ${num}`,
    facturaIntro: (n) => `${n} te ha emitido esta factura.`,
    facturaImporte: "A pagar",
    facturaVence: (f) => `Vence el ${f}.`,
    facturaBoton: "Pagar ahora",
    facturaRetencion: "El importe ya lleva descontada la retención que se libera al terminar la obra.",
    pie: (n) => `Este correo te lo envía ${n} a través de su software de gestión.`,
    piePlataforma: "Este correo es automático. No hace falta que respondas.",
  },
  en: {
    claveAsunto: "Change your password",
    claveTitulo: "Change your password",
    claveIntro: "You asked to get back in. Type this code on the screen you have open and choose a new password.",
    claveEtiqueta: "Your code",
    claveCaduca: "The code is good for one hour.",
    claveNoFuiYo: "If this wasn't you, there's nothing to do: without this code nobody can change your password.",
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
    presuAsunto: (n) => `Your estimate from ${n}`,
    presuTitulo: "Your estimate is ready",
    presuIntro: (n) => `${n} has put this estimate together for you. Take your time with it and let them know.`,
    presuTotal: "Total",
    presuAdjunto: "The full version is attached as a PDF, with the breakdown and the terms.",
    presuBoton: "View and accept it",
    presuValidez: (d) => `The price holds for ${d} days.`,
    facturaAsunto: (num, n) => `Invoice ${num} from ${n}`,
    facturaTitulo: (num) => `Invoice ${num}`,
    facturaIntro: (n) => `${n} has issued you this invoice.`,
    facturaImporte: "Amount due",
    facturaVence: (f) => `Due ${f}.`,
    facturaBoton: "Pay now",
    facturaRetencion: "The amount already has the holdback deducted; it is released when the work is finished.",
    pie: (n) => `This email was sent to you by ${n} through their management software.`,
    piePlataforma: "This is an automatic email. No need to reply.",
  },
  fr: {
    claveAsunto: "Changez votre mot de passe",
    claveTitulo: "Changez votre mot de passe",
    claveIntro: "Vous avez demandé à revenir. Saisissez ce code dans l'écran que vous avez ouvert et choisissez un nouveau mot de passe.",
    claveEtiqueta: "Votre code",
    claveCaduca: "Le code est valable une heure.",
    claveNoFuiYo: "Si ce n'était pas vous, il n'y a rien à faire : sans ce code, personne ne peut changer votre mot de passe.",
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
    presuAsunto: (n) => `Votre soumission de ${n}`,
    presuTitulo: "Votre soumission est prête",
    presuIntro: (n) => `${n} vous a préparé cette soumission. Prenez le temps de la lire et dites-lui ce que vous en pensez.`,
    presuTotal: "Total",
    presuAdjunto: "Vous l'avez en entier dans le PDF joint, avec le détail et les conditions.",
    presuBoton: "La voir et l'accepter",
    presuValidez: (d) => `Le prix tient ${d} jours.`,
    facturaAsunto: (num, n) => `Facture ${num} de ${n}`,
    facturaTitulo: (num) => `Facture ${num}`,
    facturaIntro: (n) => `${n} vous a émis cette facture.`,
    facturaImporte: "Montant à payer",
    facturaVence: (f) => `Échéance le ${f}.`,
    facturaBoton: "Payer maintenant",
    facturaRetencion: "Le montant tient déjà compte de la retenue, libérée à la fin des travaux.",
    pie: (n) => `Ce courriel vous est envoyé par ${n} via son logiciel de gestion.`,
    piePlataforma: "Ce courriel est automatique. Inutile d'y répondre.",
  },
  it: {
    claveAsunto: "Cambia la tua password",
    claveTitulo: "Cambia la tua password",
    claveIntro: "Hai chiesto di rientrare. Scrivi questo codice nella schermata che hai aperta e scegli una nuova password.",
    claveEtiqueta: "Il tuo codice",
    claveCaduca: "Il codice vale per un'ora.",
    claveNoFuiYo: "Se non sei stato tu, non devi fare nulla: senza questo codice nessuno può cambiare la tua password.",
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
    presuAsunto: (n) => `Il tuo preventivo di ${n}`,
    presuTitulo: "Il tuo preventivo è pronto",
    presuIntro: (n) => `${n} ti ha preparato questo preventivo. Leggilo con calma e facci sapere.`,
    presuTotal: "Totale",
    presuAdjunto: "Lo trovi per intero nel PDF allegato, con il dettaglio e le condizioni.",
    presuBoton: "Vedilo e accettalo",
    presuValidez: (d) => `Il prezzo resta valido ${d} giorni.`,
    facturaAsunto: (num, n) => `Fattura ${num} di ${n}`,
    facturaTitulo: (num) => `Fattura ${num}`,
    facturaIntro: (n) => `${n} ti ha emesso questa fattura.`,
    facturaImporte: "Da pagare",
    facturaVence: (f) => `Scade il ${f}.`,
    facturaBoton: "Paga ora",
    facturaRetencion: "L'importo tiene già conto della ritenuta, liberata a fine lavori.",
    pie: (n) => `Questa email ti è inviata da ${n} tramite il suo software di gestione.`,
    piePlataforma: "Questa email è automatica. Non serve rispondere.",
  },
};
