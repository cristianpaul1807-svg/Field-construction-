import PDFDocument from "pdfkit";

// Estimates and invoices are the two documents a construction business
// actually hands to a customer, so they are generated as real PDF bytes on
// the server rather than as a print-styled web page: the contractor needs a
// file they can attach to an email, keep for their records, and hand to an
// accountant, and in Quebec the invoice is a legal document that has to
// carry the GST/QST registration numbers.
//
// pdfkit's built-in Helvetica covers WinAnsi, which includes every accented
// character used by the four languages this app supports, so no font file
// needs to ship with the build.

export type DocLang = "es" | "en" | "fr" | "it";

export interface BusinessIdentity {
  name: string;
  /** Raw image bytes, already fetched. Absent when the business has no logo. */
  logo?: Buffer | null;
  logoUrl?: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  gstNumber: string | null;
  qstNumber: string | null;
  province: string | null;
}

export interface PartyIdentity {
  /** Nulo en una propuesta que todavía no tiene destinatario. */
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface DocLine {
  zone: string | null;
  item: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface TaxBreakdown {
  province?: string;
  gst?: number;
  pst?: number;
  hst?: number;
}

export interface EstimateMaterial {
  name: string;
  quantity: number;
  unit: string | null;
}

/** One stage of the payment plan, priced against this estimate's total. */
export interface EstimatePaymentStage {
  label: string;
  percent: number;
  amount: number;
}

export interface EstimateScheduleEntry {
  title: string;
  zone: string | null;
  start: Date;
  durationMinutes: number;
  worker: string | null;
}

export interface EstimateDoc {
  kind: "estimate";
  number: string;
  date: Date;
  validUntil: Date | null;
  business: BusinessIdentity;
  client: PartyIdentity;
  projectName: string | null;
  description: string | null;
  lines: DocLine[];
  subtotal: number;
  taxAmount: number;
  taxBreakdown: TaxBreakdown;
  total: number;
  holdbackPercent: number;
  terms: string | null;
  /** What will be installed. Empty when the business turns the section off. */
  materials: EstimateMaterial[];
  /** When the work happens. Empty when there is no projection, or it's off. */
  schedule: EstimateScheduleEntry[];
  /** How it gets paid, in stages. Empty when the business bills in one go. */
  payments: EstimatePaymentStage[];
  /** Present once the customer has signed. Absent leaves the blank lines. */
  signature?: EstimateSignature | null;
}

/** What the customer put their name to, and when. */
export interface EstimateSignature {
  name: string;
  signedAt: Date;
  /** PNG data URI of a drawn mark. Optional — the typed name is the signature. */
  image?: string | null;
  /** The total agreed at that moment, which may differ from today's estimate. */
  total: number;
}

/**
 * A worker's pay for one period.
 *
 * A different shape from the two customer documents — nobody is being billed —
 * so it shares only the letterhead. What it must show is what a payslip shows:
 * hours and rate, what was taken out and by whom, what the worker receives, and
 * what the whole thing cost the business.
 */
export interface PayrollDoc {
  kind: "payroll";
  number: string;
  date: Date;
  business: BusinessIdentity;
  workerName: string;
  periodStart: Date;
  periodEnd: Date;
  hours: number;
  hourlyRate: number;
  gross: number;
  lines: PayrollDocLine[];
  employeeDeductions: number;
  employerContributions: number;
  net: number;
  totalCost: number;
  /** Lo puntual de esta nómina. Sin esto, el neto del papel no cuadra. */
  adjustments?: { label: string; amount: number; taxable: boolean }[];
}

export interface PayrollDocLine {
  label: string;
  paidBy: "empleado" | "empleador";
  ratePercent: number;
  amount: number;
}

export interface InvoiceDoc {
  kind: "invoice";
  number: string;
  date: Date;
  dueDate: Date | null;
  paidAt: Date | null;
  business: BusinessIdentity;
  client: PartyIdentity;
  projectName: string | null;
  description: string | null;
  lines: DocLine[];
  subtotal: number;
  taxAmount: number;
  taxBreakdown: TaxBreakdown;
  holdbackAmount: number;
  /** Retención de facturas anteriores que esta cobra. Sin impuesto: ya se pagó. */
  holdbackReleased: number;
  total: number;
}

interface Copy {
  estimateTitle: string;
  invoiceTitle: string;
  number: string;
  date: string;
  validUntil: string;
  dueDate: string;
  billTo: string;
  project: string;
  description: string;
  zone: string;
  item: string;
  qty: string;
  unitPrice: string;
  lineTotal: string;
  subtotal: string;
  /** Un solo concepto que recoge lo que el negocio no quiso desglosar. */
  otherWork: string;
  gst: string;
  qst: string;
  pst: string;
  hst: string;
  total: string;
  license: string;
  gstNumber: string;
  qstNumber: string;
  /** Cuántas líneas lleva un informe exportado. */
  reportRows: (count: number) => string;
  holdback: string;
  holdbackRelease: string;
  holdbackNote: (percent: number) => string;
  materialsTitle: string;
  materialsNote: string;
  scheduleTitle: string;
  scheduleNote: string;
  scheduleDuration: (hours: string) => string;
  paymentsTitle: string;
  paymentsNote: string;
  signedBy: string;
  signedOn: string;
  signedTotalNote: (amount: string) => string;
  payrollTitle: string;
  payrollWorker: string;
  payrollPeriod: string;
  payrollHours: string;
  payrollRate: string;
  payrollGross: string;
  payrollEmployeeSide: string;
  payrollEmployerSide: string;
  payrollNet: string;
  payrollTotalCost: string;
  payrollAdjustments: string;
  payrollDisclaimer: string;
  acceptance: string;
  signature: string;
  signatureDate: string;
  paid: string;
  paidOn: (date: string) => string;
  thanks: string;
  page: (n: number) => string;
  noLines: string;
}

const COPY: Record<DocLang, Copy> = {
  es: {
    estimateTitle: "PRESUPUESTO",
    invoiceTitle: "FACTURA",
    number: "Número",
    date: "Fecha",
    validUntil: "Válido hasta",
    dueDate: "Vencimiento",
    billTo: "Cliente",
    project: "Proyecto",
    description: "Descripción",
    zone: "Zona",
    item: "Concepto",
    qty: "Cant.",
    unitPrice: "P. unitario",
    lineTotal: "Importe",
    subtotal: "Subtotal",
    otherWork: "Otros trabajos y mano de obra",
    gst: "TPS/GST",
    qst: "TVQ/QST",
    pst: "PST",
    hst: "HST",
    total: "TOTAL",
    license: "Licencia",
    reportRows: (n: number) => (n === 1 ? "1 línea" : `${n} líneas`),
    gstNumber: "N.º TPS",
    qstNumber: "N.º TVQ",
    paymentsTitle: "Forma de pago",
    signedBy: "Firmado por",
    signedOn: "Firmado el",
    signedTotalNote: (a) => `Importe aceptado al firmar: ${a}`,
    payrollTitle: "HOJA DE PAGO",
    payrollWorker: "Trabajador",
    payrollPeriod: "Periodo",
    payrollHours: "Horas",
    payrollRate: "Tarifa por hora",
    payrollGross: "Bruto",
    payrollEmployeeSide: "Retenciones del trabajador",
    payrollEmployerSide: "Aportaciones del empleador",
    payrollNet: "Neto a pagar",
    payrollTotalCost: "Coste total para la empresa",
    payrollAdjustments: "Ajustes de este periodo",
    payrollDisclaimer: "Documento interno de gestión. No es un comprobante oficial de retenciones: los importes se calculan con las tasas que la empresa tiene configuradas y prorrateadas al periodo, sin acumulado anual por persona.",
    paymentsNote: "Cada pago se factura cuando la obra llega a esa etapa. Los importes incluyen impuestos.",
    holdback: "Retención",
    holdbackRelease: "Liberación de retención",
    holdbackNote: (p) => `Se retiene un ${p}% de cada pago parcial hasta la finalización de los trabajos.`,
    materialsTitle: "Materiales previstos",
    materialsNote: "Cantidades estimadas; cualquier cambio se acuerda por escrito antes de ejecutarlo.",
    scheduleTitle: "Programación prevista",
    scheduleNote: "Fechas orientativas: se confirman al aceptar el presupuesto.",
    scheduleDuration: (h) => `${h} h`,
    acceptance: "Al firmar, el cliente acepta el alcance y el importe de este presupuesto.",
    signature: "Firma del cliente",
    signatureDate: "Fecha",
    paid: "PAGADA",
    paidOn: (d) => `Pagada el ${d}`,
    thanks: "Gracias por su confianza.",
    page: (n) => `Página ${n}`,
    noLines: "Sin partidas.",
  },
  en: {
    estimateTitle: "ESTIMATE",
    invoiceTitle: "INVOICE",
    number: "Number",
    date: "Date",
    validUntil: "Valid until",
    dueDate: "Due date",
    billTo: "Bill to",
    project: "Project",
    description: "Description",
    zone: "Area",
    item: "Item",
    qty: "Qty",
    unitPrice: "Unit price",
    lineTotal: "Amount",
    subtotal: "Subtotal",
    otherWork: "Other work and labour",
    gst: "GST",
    qst: "QST",
    pst: "PST",
    hst: "HST",
    total: "TOTAL",
    license: "Licence",
    reportRows: (n: number) => (n === 1 ? "1 row" : `${n} rows`),
    gstNumber: "GST no.",
    qstNumber: "QST no.",
    paymentsTitle: "How this is paid",
    signedBy: "Signed by",
    signedOn: "Signed on",
    signedTotalNote: (a) => `Amount accepted at signing: ${a}`,
    payrollTitle: "PAY SHEET",
    payrollWorker: "Worker",
    payrollPeriod: "Period",
    payrollHours: "Hours",
    payrollRate: "Hourly rate",
    payrollGross: "Gross",
    payrollEmployeeSide: "Worker deductions",
    payrollEmployerSide: "Employer contributions",
    payrollNet: "Net pay",
    payrollTotalCost: "Total cost to the business",
    payrollAdjustments: "Adjustments this period",
    payrollDisclaimer: "Internal management document. Not an official statement of deductions: amounts use the rates this business has configured, prorated over the period, without per-person year-to-date totals.",
    paymentsNote: "Each payment is invoiced when the job reaches that stage. Amounts include tax.",
    holdback: "Holdback",
    holdbackRelease: "Holdback released",
    holdbackNote: (p) => `${p}% of each progress payment is held back until the work is complete.`,
    materialsTitle: "Materials to be used",
    materialsNote: "Estimated quantities; any change is agreed in writing before it is carried out.",
    scheduleTitle: "Planned schedule",
    scheduleNote: "Indicative dates, confirmed when the estimate is accepted.",
    scheduleDuration: (h) => `${h} h`,
    acceptance: "By signing, the client accepts the scope and the amount of this estimate.",
    signature: "Client signature",
    signatureDate: "Date",
    paid: "PAID",
    paidOn: (d) => `Paid on ${d}`,
    thanks: "Thank you for your business.",
    page: (n) => `Page ${n}`,
    noLines: "No line items.",
  },
  fr: {
    estimateTitle: "SOUMISSION",
    invoiceTitle: "FACTURE",
    number: "Numéro",
    date: "Date",
    validUntil: "Valide jusqu'au",
    dueDate: "Échéance",
    billTo: "Client",
    project: "Projet",
    description: "Description",
    zone: "Zone",
    item: "Article",
    qty: "Qté",
    unitPrice: "Prix unitaire",
    lineTotal: "Montant",
    subtotal: "Sous-total",
    otherWork: "Autres travaux et main-d'œuvre",
    gst: "TPS",
    qst: "TVQ",
    pst: "TVP",
    hst: "TVH",
    total: "TOTAL",
    license: "Licence RBQ",
    reportRows: (n: number) => (n === 1 ? "1 ligne" : `${n} lignes`),
    gstNumber: "No TPS",
    qstNumber: "No TVQ",
    paymentsTitle: "Modalités de paiement",
    signedBy: "Signé par",
    signedOn: "Signé le",
    signedTotalNote: (a) => `Montant accepté à la signature : ${a}`,
    payrollTitle: "FEUILLE DE PAIE",
    payrollWorker: "Travailleur",
    payrollPeriod: "Période",
    payrollHours: "Heures",
    payrollRate: "Taux horaire",
    payrollGross: "Brut",
    payrollEmployeeSide: "Retenues du travailleur",
    payrollEmployerSide: "Cotisations de l'employeur",
    payrollNet: "Net à payer",
    payrollTotalCost: "Coût total pour l'entreprise",
    payrollAdjustments: "Ajustements de cette période",
    payrollDisclaimer: "Document interne de gestion. Ce n'est pas un relevé officiel de retenues : les montants utilisent les taux configurés par l'entreprise, au prorata de la période, sans cumul annuel par personne.",
    paymentsNote: "Chaque paiement est facturé lorsque le chantier atteint cette étape. Montants taxes comprises.",
    holdback: "Retenue",
    holdbackRelease: "Libération de la retenue",
    holdbackNote: (p) => `Une retenue de ${p} % est appliquée à chaque paiement partiel jusqu'à la fin des travaux.`,
    materialsTitle: "Matériaux prévus",
    materialsNote: "Quantités estimées ; tout changement est convenu par écrit avant d'être réalisé.",
    scheduleTitle: "Calendrier prévu",
    scheduleNote: "Dates indicatives, confirmées à l'acceptation de la soumission.",
    scheduleDuration: (h) => `${h} h`,
    acceptance: "En signant, le client accepte la portée et le montant de cette soumission.",
    signature: "Signature du client",
    signatureDate: "Date",
    paid: "PAYÉE",
    paidOn: (d) => `Payée le ${d}`,
    thanks: "Merci de votre confiance.",
    page: (n) => `Page ${n}`,
    noLines: "Aucun poste.",
  },
  it: {
    estimateTitle: "PREVENTIVO",
    invoiceTitle: "FATTURA",
    number: "Numero",
    date: "Data",
    validUntil: "Valido fino al",
    dueDate: "Scadenza",
    billTo: "Cliente",
    project: "Progetto",
    description: "Descrizione",
    zone: "Zona",
    item: "Voce",
    qty: "Qtà",
    unitPrice: "Prezzo unit.",
    lineTotal: "Importo",
    subtotal: "Subtotale",
    otherWork: "Altri lavori e manodopera",
    gst: "GST",
    qst: "QST",
    pst: "PST",
    hst: "HST",
    total: "TOTALE",
    license: "Licenza",
    reportRows: (n: number) => (n === 1 ? "1 riga" : `${n} righe`),
    gstNumber: "N. GST",
    qstNumber: "N. QST",
    paymentsTitle: "Modalità di pagamento",
    signedBy: "Firmato da",
    signedOn: "Firmato il",
    signedTotalNote: (a) => `Importo accettato alla firma: ${a}`,
    payrollTitle: "FOGLIO PAGA",
    payrollWorker: "Lavoratore",
    payrollPeriod: "Periodo",
    payrollHours: "Ore",
    payrollRate: "Tariffa oraria",
    payrollGross: "Lordo",
    payrollEmployeeSide: "Trattenute del lavoratore",
    payrollEmployerSide: "Contributi del datore di lavoro",
    payrollNet: "Netto da pagare",
    payrollTotalCost: "Costo totale per l'impresa",
    payrollAdjustments: "Rettifiche di questo periodo",
    payrollDisclaimer: "Documento interno di gestione. Non è un prospetto ufficiale delle trattenute: gli importi usano le aliquote configurate dall'impresa, ripartite sul periodo, senza cumulo annuo per persona.",
    paymentsNote: "Ogni pagamento viene fatturato quando il cantiere raggiunge quella fase. Importi tasse incluse.",
    holdback: "Ritenuta",
    holdbackRelease: "Svincolo della ritenuta",
    holdbackNote: (p) => `Viene trattenuto il ${p}% di ogni pagamento parziale fino al completamento dei lavori.`,
    materialsTitle: "Materiali previsti",
    materialsNote: "Quantità stimate; ogni variazione viene concordata per iscritto prima di eseguirla.",
    scheduleTitle: "Programmazione prevista",
    scheduleNote: "Date indicative, confermate all'accettazione del preventivo.",
    scheduleDuration: (h) => `${h} h`,
    acceptance: "Firmando, il cliente accetta l'ambito e l'importo di questo preventivo.",
    signature: "Firma del cliente",
    signatureDate: "Data",
    paid: "PAGATA",
    paidOn: (d) => `Pagata il ${d}`,
    thanks: "Grazie per la fiducia.",
    page: (n) => `Pagina ${n}`,
    noLines: "Nessuna voce.",
  },
};

const LOCALE: Record<DocLang, string> = {
  es: "es-CA",
  en: "en-CA",
  fr: "fr-CA",
  it: "it-CH",
};

/** Los rótulos de los documentos, para quien arma los datos antes de
 *  renderizarlos: el nombre de una fila agrupada es copia de documento y tiene
 *  que salir de la misma tabla que el resto. */
export function docCopy(lang: DocLang): Copy {
  return COPY[lang];
}

export function normalizeDocLang(raw: unknown): DocLang {
  const value = String(raw ?? "").slice(0, 2).toLowerCase();
  return value === "en" || value === "fr" || value === "it" || value === "es" ? value : "fr";
}

function money(amount: number, lang: DocLang) {
  return new Intl.NumberFormat(LOCALE[lang], {
    style: "currency",
    currency: "CAD",
    currencyDisplay: "symbol",
  }).format(amount);
}

function shortDate(date: Date, lang: DocLang) {
  return new Intl.DateTimeFormat(LOCALE[lang], { year: "numeric", month: "long", day: "numeric" }).format(date);
}

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Columns are fixed rather than measured so a long item name wraps inside its
// own column instead of pushing the money out of alignment.
const COL = {
  item: MARGIN,
  qty: MARGIN + 250,
  unit: MARGIN + 310,
  total: MARGIN + 400,
};
const COL_WIDTH = {
  item: 240,
  qty: 50,
  unit: 80,
  total: 95,
};

type Doc = PDFKit.PDFDocument;

/**
 * El membrete: quién emite este papel.
 *
 * Está aparte porque lo llevan todos los documentos que salen de la empresa,
 * no sólo los tres que había. Un papel que se entrega o se archiva sin decir
 * de qué empresa es, con su licencia y sus números fiscales, no vale como
 * documento — y el trabajo de acordarse no puede ser de cada pantalla.
 *
 * Devuelve dónde termina, medido de verdad.
 */
function letterhead(doc: Doc, b: BusinessIdentity, copy: Copy): number {
  // A logo replaces the name in the letterhead when there is one, but the
  // name still has to appear somewhere legible — a logo whose wordmark is
  // unreadable at 40 points would otherwise leave the document unattributed.
  let nameY = MARGIN;
  if (b.logo) {
    try {
      // La caja estaba pensada para un logotipo alargado y ahogaba a los
      // cuadrados, que son la mayoría en este oficio: el de un contratista
      // salía a 45 px, más pequeño que su propio nombre al lado. Cabe hasta
      // 150 de ancho igual, así que un logotipo apaisado no cambia.
      doc.image(b.logo, MARGIN, MARGIN, { fit: [150, 58] });
      nameY = MARGIN + 64;
    } catch {
      // A corrupt or unsupported image must not take the whole document down;
      // falling through leaves the plain text letterhead.
    }
  }

  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111111").text(b.name, MARGIN, nameY, { width: 300 });

  const identity = [
    b.address,
    [b.phone, b.email].filter(Boolean).join(" · ") || null,
    b.licenseNumber ? `${copy.license}: ${b.licenseNumber}` : null,
    b.gstNumber ? `${copy.gstNumber}: ${b.gstNumber}` : null,
    b.qstNumber ? `${copy.qstNumber}: ${b.qstNumber}` : null,
  ].filter(Boolean) as string[];

  doc.font("Helvetica").fontSize(9).fillColor("#555555");
  identity.forEach((line) => doc.text(line, MARGIN, doc.y, { width: 300 }));

  return doc.y;
}

function header(doc: Doc, data: EstimateDoc | InvoiceDoc | PayrollDoc, copy: Copy, lang: DocLang) {
  const b = data.business;

  // Dónde acaba de verdad el membrete, medido antes de escribir nada más: el
  // título de la derecha se dibuja arriba del todo y devuelve el cursor casi
  // al margen superior, así que consultarlo después daba una posición más
  // alta que el bloque de la empresa. Con logo, el membrete crece 52 puntos y
  // la línea divisoria se quedaba por encima: los datos fiscales acababan
  // impresos encima del nombre del cliente.
  const letterheadBottom = letterhead(doc, b, copy);

  const title =
    data.kind === "estimate" ? copy.estimateTitle : data.kind === "payroll" ? copy.payrollTitle : copy.invoiceTitle;
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#111111").text(title, MARGIN, MARGIN, {
    width: CONTENT_WIDTH,
    align: "right",
  });

  const meta: [string, string][] = [
    [copy.number, data.number],
    [copy.date, shortDate(data.date, lang)],
  ];
  if (data.kind === "estimate" && data.validUntil) meta.push([copy.validUntil, shortDate(data.validUntil, lang)]);
  if (data.kind === "invoice" && data.dueDate) meta.push([copy.dueDate, shortDate(data.dueDate, lang)]);

  let metaY = MARGIN + 28;
  doc.font("Helvetica").fontSize(9).fillColor("#555555");
  meta.forEach(([label, value]) => {
    doc.text(`${label}: ${value}`, MARGIN, metaY, { width: CONTENT_WIDTH, align: "right" });
    metaY += 13;
  });

  if (data.kind === "invoice" && data.paidAt) {
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#1a7f37")
      .text(copy.paidOn(shortDate(data.paidAt, lang)), MARGIN, metaY + 2, {
        width: CONTENT_WIDTH,
        align: "right",
      });
    metaY += 16;
  }

  const y = Math.max(letterheadBottom, doc.y, metaY) + 14;
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor("#dddddd").lineWidth(1).stroke();
  doc.y = y + 16;
}

function parties(doc: Doc, data: EstimateDoc | InvoiceDoc, copy: Copy) {
  const top = doc.y;

  // Una propuesta en frío todavía no es de nadie. Antes salía un "CLIENTE"
  // seguido de un guión, que en un documento que se entrega en mano parece un
  // error de la aplicación; se omite el bloque entero y ya está.
  if (data.client.name) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#888888").text(copy.billTo.toUpperCase(), MARGIN, top);
    doc.font("Helvetica").fontSize(10).fillColor("#111111").text(data.client.name, MARGIN, doc.y + 2, { width: 250 });
    doc.fontSize(9).fillColor("#555555");
    [data.client.address, data.client.phone, data.client.email]
      .filter(Boolean)
      .forEach((line) => doc.text(line as string, MARGIN, doc.y, { width: 250 }));
  }

  const leftBottom = doc.y;

  if (data.projectName) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#888888").text(copy.project.toUpperCase(), MARGIN + 300, top, {
      width: 245,
    });
    doc.font("Helvetica").fontSize(10).fillColor("#111111").text(data.projectName, MARGIN + 300, doc.y + 2, {
      width: 245,
    });
  }

  doc.y = Math.max(leftBottom, doc.y) + 16;

  if (data.description) {
    doc.font("Helvetica").fontSize(9).fillColor("#555555").text(data.description, MARGIN, doc.y, {
      width: CONTENT_WIDTH,
    });
    doc.y += 12;
  }
}

function tableHeader(doc: Doc, copy: Copy) {
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#888888");
  doc.text(copy.item.toUpperCase(), COL.item, y, { width: COL_WIDTH.item });
  doc.text(copy.qty.toUpperCase(), COL.qty, y, { width: COL_WIDTH.qty, align: "right" });
  doc.text(copy.unitPrice.toUpperCase(), COL.unit, y, { width: COL_WIDTH.unit, align: "right" });
  doc.text(copy.lineTotal.toUpperCase(), COL.total, y, { width: COL_WIDTH.total, align: "right" });
  const lineY = y + 12;
  doc.moveTo(MARGIN, lineY).lineTo(PAGE_WIDTH - MARGIN, lineY).strokeColor("#dddddd").lineWidth(0.5).stroke();
  doc.y = lineY + 6;
}

// Every row measures itself before drawing so a wrapped item name never gets
// cut in half by a page break.
function ensureRoom(doc: Doc, needed: number, copy: Copy) {
  if (doc.y + needed < doc.page.height - MARGIN - 30) return;
  doc.addPage();
  doc.y = MARGIN;
  tableHeader(doc, copy);
}

function lineTable(doc: Doc, data: EstimateDoc | InvoiceDoc, copy: Copy, lang: DocLang) {
  tableHeader(doc, copy);

  if (data.lines.length === 0) {
    doc.font("Helvetica").fontSize(9).fillColor("#888888").text(copy.noLines, MARGIN, doc.y + 4);
    doc.y += 20;
    return;
  }

  let currentZone: string | null | undefined;

  for (const line of data.lines) {
    const zone = line.zone || null;
    if (zone !== currentZone) {
      currentZone = zone;
      if (zone) {
        ensureRoom(doc, 24, copy);
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(zone, MARGIN, doc.y + 4, {
          width: CONTENT_WIDTH,
        });
        doc.y += 4;
      }
    }

    doc.font("Helvetica").fontSize(9).fillColor("#333333");
    const height = doc.heightOfString(line.item, { width: COL_WIDTH.item });
    ensureRoom(doc, height + 10, copy);

    const y = doc.y;
    doc.text(line.item, COL.item, y, { width: COL_WIDTH.item });
    doc.text(String(line.quantity), COL.qty, y, { width: COL_WIDTH.qty, align: "right" });
    doc.text(money(line.unitCost, lang), COL.unit, y, { width: COL_WIDTH.unit, align: "right" });
    doc.text(money(line.total, lang), COL.total, y, { width: COL_WIDTH.total, align: "right" });
    doc.y = y + height + 5;
  }

  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).strokeColor("#dddddd").lineWidth(0.5).stroke();
  doc.y += 8;
}

function totals(doc: Doc, data: EstimateDoc | InvoiceDoc, copy: Copy, lang: DocLang) {
  const rows: [string, string, boolean][] = [[copy.subtotal, money(data.subtotal, lang), false]];

  const tb = data.taxBreakdown ?? {};
  if (tb.hst !== undefined) rows.push([copy.hst, money(tb.hst, lang), false]);
  if (tb.gst !== undefined) rows.push([copy.gst, money(tb.gst, lang), false]);
  if (tb.pst !== undefined) {
    // Quebec's provincial tax is the QST; everywhere else it's a PST, and the
    // province on the breakdown is what tells the two apart.
    rows.push([tb.province === "QC" ? copy.qst : copy.pst, money(tb.pst, lang), false]);
  }
  if (data.kind === "invoice" && data.holdbackAmount > 0) {
    // Shown as a negative line so the customer can see the invoiced value and
    // the amount actually payable are different, and by exactly how much.
    rows.push([copy.holdback, `-${money(data.holdbackAmount, lang)}`, false]);
  }
  if (data.kind === "invoice" && data.holdbackReleased > 0) {
    // The mirror of those negative lines, arriving on the closing invoice. A
    // customer who saw money held back on every earlier bill has to see where
    // it comes back, or the final total looks like an overcharge.
    rows.push([copy.holdbackRelease, `+${money(data.holdbackReleased, lang)}`, false]);
  }
  rows.push([copy.total, money(data.total, lang), true]);

  const labelX = MARGIN + 290;
  const valueX = MARGIN + 400;

  ensureRoom(doc, rows.length * 16 + 20, copy);

  for (const [label, value, strong] of rows) {
    if (strong) {
      doc.moveTo(labelX, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).strokeColor("#111111").lineWidth(0.8).stroke();
      doc.y += 5;
    }
    const y = doc.y;
    doc
      .font(strong ? "Helvetica-Bold" : "Helvetica")
      .fontSize(strong ? 11 : 9)
      .fillColor(strong ? "#111111" : "#555555");
    doc.text(label, labelX, y, { width: 100, align: "right" });
    doc.text(value, valueX, y, { width: COL_WIDTH.total, align: "right" });
    doc.y = y + (strong ? 16 : 13);
  }

  doc.y += 10;
}

// Two sections that answer what the price alone does not: what goes in, and
// when it happens. Both are drawn from data the estimate already holds — the
// lines and the work projection — so nothing here is retyped or invented.
function extraSections(doc: Doc, data: EstimateDoc, copy: Copy, lang: DocLang) {
  if (data.materials.length > 0) {
    ensureRoom(doc, 60, copy);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(copy.materialsTitle, MARGIN, doc.y);
    doc.y += 4;
    doc.font("Helvetica").fontSize(8.5).fillColor("#333333");
    for (const material of data.materials) {
      ensureRoom(doc, 14, copy);
      const y = doc.y;
      doc.text(`· ${material.name}`, MARGIN + 6, y, { width: CONTENT_WIDTH - 120 });
      doc.text(
        material.unit ? `${material.quantity} ${material.unit}` : String(material.quantity),
        MARGIN + CONTENT_WIDTH - 110,
        y,
        { width: 110, align: "right" }
      );
      doc.y = Math.max(doc.y, y + 12);
    }
    doc.font("Helvetica").fontSize(7.5).fillColor("#888888").text(copy.materialsNote, MARGIN, doc.y + 2, {
      width: CONTENT_WIDTH,
    });
    doc.y += 10;
  }

  if (data.schedule.length > 0) {
    ensureRoom(doc, 60, copy);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(copy.scheduleTitle, MARGIN, doc.y);
    doc.y += 4;
    doc.font("Helvetica").fontSize(8.5).fillColor("#333333");
    for (const entry of data.schedule) {
      ensureRoom(doc, 14, copy);
      const y = doc.y;
      const label = [entry.title, entry.zone].filter(Boolean).join(" · ");
      doc.text(`· ${label}`, MARGIN + 6, y, { width: CONTENT_WIDTH - 190 });
      const hours = (entry.durationMinutes / 60).toFixed(1).replace(/\.0$/, "");
      doc.text(
        `${shortDate(entry.start, lang)} · ${copy.scheduleDuration(hours)}`,
        MARGIN + CONTENT_WIDTH - 180,
        y,
        { width: 180, align: "right" }
      );
      doc.y = Math.max(doc.y, y + 12);
    }
    doc.font("Helvetica").fontSize(7.5).fillColor("#888888").text(copy.scheduleNote, MARGIN, doc.y + 2, {
      width: CONTENT_WIDTH,
    });
    doc.y += 10;
  }
}

function estimateFooter(doc: Doc, data: EstimateDoc, copy: Copy, lang: DocLang) {
  ensureRoom(doc, 120, copy);

  // A customer signing is agreeing to the whole schedule, not just the first
  // cheque, so the stages are what the document states. This replaced a single
  // "deposit: N%" line, which said less and could disagree with the plan.
  if (data.payments.length > 0) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(copy.paymentsTitle, MARGIN, doc.y);
    doc.y += 4;
    for (const stage of data.payments) {
      ensureRoom(doc, 14, copy);
      const y = doc.y;
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#333333")
        .text(`· ${stage.label} (${stage.percent}%)`, MARGIN + 6, y, { width: CONTENT_WIDTH - 140 });
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor("#111111")
        .text(money(stage.amount, lang), MARGIN + CONTENT_WIDTH - 130, y, { width: 130, align: "right" });
      doc.y = Math.max(doc.y, y + 12);
    }
    doc.font("Helvetica").fontSize(7.5).fillColor("#888888").text(copy.paymentsNote, MARGIN, doc.y + 2, {
      width: CONTENT_WIDTH,
    });
    doc.y += 12;
  }

  if (data.holdbackPercent > 0) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#555555")
      .text(copy.holdbackNote(data.holdbackPercent), MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.y += 8;
  }

  if (data.terms) {
    doc.font("Helvetica").fontSize(8).fillColor("#555555").text(data.terms, MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.y += 8;
  }

  doc.font("Helvetica").fontSize(8).fillColor("#555555").text(copy.acceptance, MARGIN, doc.y, {
    width: CONTENT_WIDTH,
  });
  doc.y += 34;

  // A signed estimate must not print an empty signature line. That was the
  // old behaviour and it made an accepted document look unsigned to anyone
  // who read it — including the contractor who was relying on it.
  if (data.signature) {
    const sig = data.signature;

    // A drawn mark needs its own band above the rule. Without reserving it the
    // squiggle lands across the typed name and strikes it through, which is
    // both ugly and — on the one document that has to be legible years later —
    // actively unhelpful.
    if (sig.image) {
      ensureRoom(doc, 90, copy);
      doc.y += 34;
    }

    const signatureY = doc.y;
    if (sig.image) {
      try {
        doc.image(sig.image, MARGIN, signatureY - 48, { fit: [200, 44] });
      } catch {
        // A malformed data URI must not take the document down; the typed
        // name below is the signature that matters anyway.
      }
    }
    doc.moveTo(MARGIN, signatureY).lineTo(MARGIN + 220, signatureY).strokeColor("#999999").lineWidth(0.5).stroke();
    doc.moveTo(MARGIN + 280, signatureY).lineTo(MARGIN + 440, signatureY).strokeColor("#999999").lineWidth(0.5).stroke();

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
    doc.text(sig.name, MARGIN, signatureY + 4, { width: 220 });
    doc.text(shortDate(sig.signedAt, lang), MARGIN + 280, signatureY + 4, { width: 160 });

    doc.font("Helvetica").fontSize(7.5).fillColor("#888888");
    doc.text(copy.signedBy, MARGIN, signatureY + 17, { width: 220 });
    doc.text(copy.signedOn, MARGIN + 280, signatureY + 17, { width: 160 });

    doc.y = signatureY + 30;
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#888888")
      .text(copy.signedTotalNote(money(sig.total, lang)), MARGIN, doc.y, { width: CONTENT_WIDTH });
    return;
  }

  const signatureY = doc.y;
  doc.moveTo(MARGIN, signatureY).lineTo(MARGIN + 220, signatureY).strokeColor("#999999").lineWidth(0.5).stroke();
  doc.moveTo(MARGIN + 280, signatureY).lineTo(MARGIN + 440, signatureY).strokeColor("#999999").lineWidth(0.5).stroke();
  doc.font("Helvetica").fontSize(8).fillColor("#888888");
  doc.text(copy.signature, MARGIN, signatureY + 4, { width: 220 });
  doc.text(copy.signatureDate, MARGIN + 280, signatureY + 4, { width: 160 });
}

function invoiceFooter(doc: Doc, _data: InvoiceDoc, copy: Copy) {
  ensureRoom(doc, 40, copy);
  doc.font("Helvetica").fontSize(9).fillColor("#555555").text(copy.thanks, MARGIN, doc.y, {
    width: CONTENT_WIDTH,
  });
}

function pageNumbers(doc: Doc, copy: Copy) {
  const range = doc.bufferedPageRange();
  // A one-page estimate saying "Page 1" only adds noise; the number matters
  // once the document actually runs over and pages can be separated.
  if (range.count < 2) return;
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#999999")
      .text(copy.page(i + 1), MARGIN, doc.page.height - MARGIN - 12, {
        width: CONTENT_WIDTH,
        align: "center",
        lineBreak: false,
      });
  }
}

/**
 * Las fuentes estándar de PDF no llevan la ligadura œ y pdfkit la tira sin
 * avisar: "main-d'œuvre" sale impreso "main-d'uvre" y "cœur", "cur". No es un
 * problema de nuestra copia —que ya la evitaba— sino de lo que escribe el
 * contratista: en Quebec, "Main-d'œuvre" es lo primero que teclea en una línea
 * de presupuesto, y ese texto acaba en el papel que firma su cliente.
 *
 * Se cambia por "oe", que es la grafía alternativa aceptada y se lee bien.
 * Va envuelto sobre el propio documento para que valga para todo lo que se
 * imprima, venga de nuestra copia o de sus datos.
 */
/**
 * El unico caracter que estas fuentes no saben escribir.
 *
 * Medido byte a byte antes de tocar nada, porque la primera vez me equivoque:
 * crei que se comian la ligadura oe y no era cierto —la escriben como 0x9C, que
 * es lo correcto en WinAnsi—; lo que pasaba es que mi propio extractor pintaba
 * ese byte como un caracter invisible y yo leia "main-d'uvre". El guion largo,
 * los puntos suspensivos y las comillas curvas tambien salen bien.
 *
 * El que no sale es el menos tipografico U+2212: pdfkit escupe sus dos bytes en
 * crudo y en el papel aparece una comilla. Lo escribi yo en la linea de ajustes
 * de una hoja de pago, y salia «"50,00 $» justo en el renglon que le resta
 * dinero a alguien.
 */
function sinCaracteresQueNoSabeEscribir(valor: unknown): unknown {
  return typeof valor === "string" ? valor.replace(/\u2212/g, "-") : valor;
}

function nuevoDocumento(): Doc {
  // bufferPages guarda cada página en memoria para poder sellar el "Página N"
  // cuando ya se sabe cuántas hay.
  const doc: Doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  const original = doc.text.bind(doc);
  (doc as any).text = (texto: unknown, ...resto: unknown[]) => original(sinCaracteresQueNoSabeEscribir(texto) as string, ...(resto as []));
  return doc;
}

function render(data: EstimateDoc | InvoiceDoc, lang: DocLang): Promise<Buffer> {
  const copy = COPY[lang];
  const doc = nuevoDocumento();

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  header(doc, data, copy, lang);
  parties(doc, data, copy);
  lineTable(doc, data, copy, lang);
  totals(doc, data, copy, lang);
  if (data.kind === "estimate") {
    extraSections(doc, data, copy, lang);
    estimateFooter(doc, data, copy, lang);
  }
  else invoiceFooter(doc, data, copy);
  pageNumbers(doc, copy);

  doc.end();
  return done;
}

/**
 * Un informe: cualquiera de las tablas del panel, en papel con membrete.
 *
 * Las tablas se exportaban a CSV, que sirve para trabajarlas en Excel pero no
 * para entregarlas ni archivarlas: un archivo con nombres y horas y ni una
 * palabra de qué empresa lo emitió no es un documento. Esto es el mismo
 * dato con el membrete que llevan la factura y el presupuesto.
 *
 * Las columnas vienen de la pantalla porque cada tabla tiene las suyas y el
 * jefe además elige cuáles enseña. El membrete no viene de la pantalla: lo
 * pone el servidor con los datos del negocio de la sesión.
 */
export interface ReportDoc {
  kind: "report";
  title: string;
  business: BusinessIdentity;
  /** Sale bajo el título: de qué obra es, si se exportó con filtro. */
  scope: string | null;
  generatedAt: Date;
  columns: { label: string; align: "left" | "right" }[];
  rows: string[][];
  /** La fila de totales, si la tabla tenía. */
  totals: string[] | null;
}

export function renderReportPdf(data: ReportDoc, lang: DocLang): Promise<Buffer> {
  const copy = COPY[lang];
  // Apaisado: una tabla de diez columnas en vertical deja las últimas en un
  // hilo. El membrete es el mismo, sólo que más ancho.
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: MARGIN, bufferPages: true });
  const anchoPagina = 841.89;
  const anchoUtil = anchoPagina - MARGIN * 2;

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const finMembrete = letterhead(doc, data.business, copy);

  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111111")
    .text(data.title, MARGIN, MARGIN, { width: anchoUtil, align: "right" });

  const meta = [
    data.scope,
    `${copy.date}: ${shortDate(data.generatedAt, lang)}`,
    copy.reportRows(data.rows.length),
  ].filter(Boolean) as string[];

  let metaY = MARGIN + 26;
  doc.font("Helvetica").fontSize(9).fillColor("#555555");
  for (const linea of meta) {
    doc.text(linea, MARGIN, metaY, { width: anchoUtil, align: "right" });
    metaY += 13;
  }

  let y = Math.max(finMembrete, metaY) + 14;
  doc.moveTo(MARGIN, y).lineTo(anchoPagina - MARGIN, y).strokeColor("#dddddd").lineWidth(1).stroke();
  y += 14;

  // El ancho se reparte por lo que ocupa cada columna de verdad —cabecera y
  // contenido—, no a partes iguales: con diez columnas, "Sí/No" no necesita
  // lo mismo que el nombre de una obra.
  // La cabecera se mide tal y como se dibuja —en mayúsculas y negrita—, que
  // es más ancho que el rótulo tal cual: midiéndolo en minúscula, "TIPO DE
  // SERVICIO" no cabía, se partía en dos líneas y pisaba la primera fila.
  const rotulos = data.columns.map((c) => c.label.toUpperCase());
  const anchoDe = (i: number) => {
    doc.font("Helvetica-Bold").fontSize(8);
    let max = doc.widthOfString(rotulos[i]);
    doc.font("Helvetica").fontSize(8);
    for (const fila of data.rows) max = Math.max(max, doc.widthOfString(fila[i] ?? ""));
    return Math.min(Math.max(max, 30), 200);
  };
  const brutos = data.columns.map((_, i) => anchoDe(i));
  const suma = brutos.reduce((a, b) => a + b, 0) + data.columns.length * 8;
  const escala = suma > anchoUtil ? (anchoUtil - data.columns.length * 8) / (suma - data.columns.length * 8) : 1;
  const anchos = brutos.map((b) => b * escala);

  const equis: number[] = [];
  let acumulado = MARGIN;
  for (const a of anchos) {
    equis.push(acumulado);
    acumulado += a + 8;
  }

  const cabeceraTabla = () => {
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#555555");
    // Si al repartir el ancho alguna cabecera se queda corta y se parte en
    // dos líneas, la fila crece: es preferible a que se coma la de abajo.
    const alto = Math.max(...rotulos.map((r, i) => doc.heightOfString(r, { width: anchos[i] })));
    data.columns.forEach((c, i) => {
      doc.text(rotulos[i], equis[i], y, { width: anchos[i], align: c.align });
    });
    y += alto + 5;
    doc.moveTo(MARGIN, y - 3).lineTo(anchoPagina - MARGIN, y - 3).strokeColor("#dddddd").lineWidth(0.5).stroke();
  };

  cabeceraTabla();

  const fondoPagina = 595.28 - MARGIN - 24;
  for (const fila of data.rows) {
    doc.font("Helvetica").fontSize(8).fillColor("#111111");
    // Lo alto que hay que dejar es lo que ocupe la celda más alta: con el
    // alto fijo, un nombre largo se comía la fila de debajo.
    const alto = Math.max(
      ...data.columns.map((c, i) => doc.heightOfString(fila[i] ?? "", { width: anchos[i] }))
    );
    if (y + alto > fondoPagina) {
      doc.addPage({ size: "A4", layout: "landscape", margin: MARGIN });
      y = MARGIN;
      cabeceraTabla();
    }
    // Después del salto y no antes: dibujar la cabecera deja la fuente en
    // negrita, y la primera fila de cada página salía en negrita y más ancha
    // de lo medido, así que se partía encima de la siguiente.
    doc.font("Helvetica").fontSize(8).fillColor("#111111");
    data.columns.forEach((c, i) => {
      doc.text(fila[i] ?? "", equis[i], y, { width: anchos[i], align: c.align });
    });
    y += alto + 6;
    doc.moveTo(MARGIN, y - 3).lineTo(anchoPagina - MARGIN, y - 3).strokeColor("#eeeeee").lineWidth(0.5).stroke();
  }

  if (data.totals) {
    if (y + 20 > fondoPagina) {
      doc.addPage({ size: "A4", layout: "landscape", margin: MARGIN });
      y = MARGIN;
      cabeceraTabla();
    }
    y += 2;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#111111");
    data.columns.forEach((c, i) => {
      doc.text(data.totals![i] ?? "", equis[i], y, { width: anchos[i], align: c.align, lineBreak: false });
    });
    y += 16;
  }

  pageNumbers(doc, copy);
  doc.end();
  return done;
}

export function renderEstimatePdf(data: EstimateDoc, lang: DocLang): Promise<Buffer> {
  return render(data, lang);
}

export function renderInvoicePdf(data: InvoiceDoc, lang: DocLang): Promise<Buffer> {
  return render(data, lang);
}

export function renderPayrollPdf(data: PayrollDoc, lang: DocLang): Promise<Buffer> {
  const copy = COPY[lang];
  // La hoja de pago se creaba su propio documento y se saltaba la guarda.
  const doc = nuevoDocumento();

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  header(doc, data, copy, lang);

  const field = (label: string, value: string) => {
    const y = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor("#888888").text(label, MARGIN, y, { width: 200 });
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text(value, MARGIN + 200, y, {
      width: CONTENT_WIDTH - 200,
    });
    doc.y = Math.max(doc.y, y + 15);
  };

  field(copy.payrollWorker, data.workerName);
  field(copy.payrollPeriod, `${shortDate(data.periodStart, lang)} — ${shortDate(data.periodEnd, lang)}`);
  field(copy.payrollHours, String(data.hours));
  field(copy.payrollRate, money(data.hourlyRate, lang));
  field(copy.payrollGross, money(data.gross, lang));

  doc.y += 8;

  // Two blocks rather than one list: what comes out of the worker and what the
  // employer adds on top are different money, and running them together is
  // exactly how a payslip gets misread.
  const block = (title: string, side: "empleado" | "empleador", subtotal: number) => {
    const rows = data.lines.filter((l) => l.paidBy === side);
    if (rows.length === 0) return;
    ensureRoom(doc, 40, copy);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(title, MARGIN, doc.y);
    doc.y += 4;
    for (const row of rows) {
      ensureRoom(doc, 14, copy);
      const y = doc.y;
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#333333")
        .text(`· ${row.label} (${row.ratePercent} %)`, MARGIN + 6, y, { width: CONTENT_WIDTH - 140 });
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#333333")
        .text(money(row.amount, lang), MARGIN + CONTENT_WIDTH - 130, y, { width: 130, align: "right" });
      doc.y = Math.max(doc.y, y + 12);
    }
    const y = doc.y + 2;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
    doc.text(money(subtotal, lang), MARGIN + CONTENT_WIDTH - 130, y, { width: 130, align: "right" });
    doc.y = y + 16;
  };

  block(copy.payrollEmployeeSide, "empleado", data.employeeDeductions);
  block(copy.payrollEmployerSide, "empleador", data.employerContributions);

  // Sin esto, quien recibe el papel ve un neto que no sale de las cuentas de
  // arriba y no tiene forma de saber de dónde vienen los 200 $ que faltan.
  const ajustes = data.adjustments ?? [];
  if (ajustes.length > 0) {
    ensureRoom(doc, 24 + ajustes.length * 14, copy);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(copy.payrollAdjustments, MARGIN, doc.y);
    doc.y += 4;
    for (const ajuste of ajustes) {
      const y = doc.y;
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#333333")
        .text(`· ${ajuste.label}`, MARGIN + 6, y, { width: CONTENT_WIDTH - 140 });
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#333333")
        .text(`${ajuste.amount > 0 ? "+" : "-"}${money(Math.abs(ajuste.amount), lang)}`, MARGIN + CONTENT_WIDTH - 130, y, {
          width: 130,
          align: "right",
        });
      doc.y = Math.max(doc.y, y + 12);
    }
    doc.y += 6;
  }

  ensureRoom(doc, 60, copy);
  const lineY = doc.y;
  doc.moveTo(MARGIN, lineY).lineTo(PAGE_WIDTH - MARGIN, lineY).strokeColor("#111111").lineWidth(1).stroke();
  doc.y = lineY + 8;

  const bigTotal = (label: string, value: number) => {
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text(label, MARGIN, y, { width: 300 });
    doc.text(money(value, lang), MARGIN + CONTENT_WIDTH - 160, y, { width: 160, align: "right" });
    doc.y = Math.max(doc.y, y + 17);
  };
  bigTotal(copy.payrollNet, data.net);
  bigTotal(copy.payrollTotalCost, data.totalCost);

  doc.y += 8;
  doc.font("Helvetica").fontSize(7.5).fillColor("#888888").text(copy.payrollDisclaimer, MARGIN, doc.y, {
    width: CONTENT_WIDTH,
  });

  pageNumbers(doc, copy);
  doc.end();
  return done;
}

/** `EST-3F2A91C4` / `INV-…` / `PAY-…` — short, stable, and unique per row. */
export function documentNumber(kind: "estimate" | "invoice" | "payroll", id: string) {
  const prefix = kind === "estimate" ? "EST" : kind === "payroll" ? "PAY" : "INV";
  return `${prefix}-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
