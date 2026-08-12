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
  address: string | null;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  gstNumber: string | null;
  qstNumber: string | null;
  province: string | null;
}

export interface PartyIdentity {
  name: string;
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
  depositPercent: number;
  terms: string | null;
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
  gst: string;
  qst: string;
  pst: string;
  hst: string;
  total: string;
  license: string;
  gstNumber: string;
  qstNumber: string;
  deposit: (percent: number, amount: string) => string;
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
    gst: "TPS/GST",
    qst: "TVQ/QST",
    pst: "PST",
    hst: "HST",
    total: "TOTAL",
    license: "Licencia",
    gstNumber: "N.º TPS",
    qstNumber: "N.º TVQ",
    deposit: (p, a) => `Depósito para iniciar los trabajos: ${p}% (${a})`,
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
    gst: "GST",
    qst: "QST",
    pst: "PST",
    hst: "HST",
    total: "TOTAL",
    license: "Licence",
    gstNumber: "GST no.",
    qstNumber: "QST no.",
    deposit: (p, a) => `Deposit to start the work: ${p}% (${a})`,
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
    gst: "TPS",
    qst: "TVQ",
    pst: "TVP",
    hst: "TVH",
    total: "TOTAL",
    license: "Licence RBQ",
    gstNumber: "No TPS",
    qstNumber: "No TVQ",
    deposit: (p, a) => `Dépôt pour démarrer les travaux : ${p} % (${a})`,
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
    gst: "GST",
    qst: "QST",
    pst: "PST",
    hst: "HST",
    total: "TOTALE",
    license: "Licenza",
    gstNumber: "N. GST",
    qstNumber: "N. QST",
    deposit: (p, a) => `Acconto per avviare i lavori: ${p}% (${a})`,
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

function header(doc: Doc, data: EstimateDoc | InvoiceDoc, copy: Copy, lang: DocLang) {
  const b = data.business;

  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111111").text(b.name, MARGIN, MARGIN, { width: 300 });

  const identity = [
    b.address,
    [b.phone, b.email].filter(Boolean).join(" · ") || null,
    b.licenseNumber ? `${copy.license}: ${b.licenseNumber}` : null,
    b.gstNumber ? `${copy.gstNumber}: ${b.gstNumber}` : null,
    b.qstNumber ? `${copy.qstNumber}: ${b.qstNumber}` : null,
  ].filter(Boolean) as string[];

  doc.font("Helvetica").fontSize(9).fillColor("#555555");
  identity.forEach((line) => doc.text(line, MARGIN, doc.y, { width: 300 }));

  const title = data.kind === "estimate" ? copy.estimateTitle : copy.invoiceTitle;
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

  const y = Math.max(doc.y, metaY) + 14;
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor("#dddddd").lineWidth(1).stroke();
  doc.y = y + 16;
}

function parties(doc: Doc, data: EstimateDoc | InvoiceDoc, copy: Copy) {
  const top = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#888888").text(copy.billTo.toUpperCase(), MARGIN, top);
  doc.font("Helvetica").fontSize(10).fillColor("#111111").text(data.client.name, MARGIN, doc.y + 2, { width: 250 });
  doc.fontSize(9).fillColor("#555555");
  [data.client.address, data.client.phone, data.client.email]
    .filter(Boolean)
    .forEach((line) => doc.text(line as string, MARGIN, doc.y, { width: 250 }));

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

function estimateFooter(doc: Doc, data: EstimateDoc, copy: Copy, lang: DocLang) {
  ensureRoom(doc, 120, copy);

  if (data.depositPercent > 0) {
    const depositAmount = Math.round(data.total * (data.depositPercent / 100) * 100) / 100;
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#111111")
      .text(copy.deposit(data.depositPercent, money(depositAmount, lang)), MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
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

function render(data: EstimateDoc | InvoiceDoc, lang: DocLang): Promise<Buffer> {
  const copy = COPY[lang];
  // bufferPages keeps every page in memory so the "Page N" footer can be
  // stamped once the final page count is known.
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });

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
  if (data.kind === "estimate") estimateFooter(doc, data, copy, lang);
  else invoiceFooter(doc, data, copy);
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

/** `EST-3F2A91C4` / `INV-3F2A91C4` — short, stable, and unique per row. */
export function documentNumber(kind: "estimate" | "invoice", id: string) {
  return `${kind === "estimate" ? "EST" : "INV"}-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
