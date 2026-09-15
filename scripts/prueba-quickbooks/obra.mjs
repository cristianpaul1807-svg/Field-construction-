// Una obra entera, de principio a fin, mirando el documento exacto que sale
// hacia QuickBooks en cada paso.
//
// Los números son los de Quebec: 5 000 $ de trabajo, TPS 5 %, TVQ 9,975 %,
// retención del 10 %. Son los mismos de la primera factura real de Néstor.
import { sync, enviados, hacerAdmin } from "./correr.mjs";

const NEGOCIO = "neg-1";
const fallos = [];
const bien = [];
function comprobar(que, condicion, detalle) {
  (condicion ? bien : fallos).push(`${que}${detalle ? ` — ${detalle}` : ""}`);
}
const dinero = (x) => `${Number(x).toFixed(2)} $`;

let admin;
const filas = {
  quickbooks_links: (f) => {
    const suyas = admin.escrituras.filter(
      (e) => e.tabla === "quickbooks_links" && e.fila.kind === f.kind && e.fila.local_id === f.local_id
    );
    return suyas.length ? suyas[suyas.length - 1].fila : null;
  },
  businesses: { id: NEGOCIO, province: "QC", payroll_in_quickbooks: false },
  clients: { id: "cli-1", name: "Client Test inc.", email: "c@test.ca", phone: "514-555-0000", address: "1 rue Test, Montréal" },
  invoices: {
    id: "fac-1", number: "2026-0001", client_id: "cli-1", created_at: "2026-09-01",
    due_date: "2026-10-01", description: "Rénovation salle de bain", subtotal: 5000,
    status: "emitido", projects: { name: "Obra Laurier" },
  },
  credit_notes: {
    id: "nc-1", number: "NC-2026-0001", reason: "Corrección de importe", subtotal: 500,
    created_at: "2026-09-10", invoices: { client_id: "cli-1" },
  },
  payments: {
    id: "pag-1", invoice_id: "fac-1", amount: 5248.75, paid_at: "2026-09-05",
    method: "stripe", reference: "pi_test_123", invoices: { client_id: "cli-1", number: "2026-0001" },
    stripe_fee: 155.71, stripe_fee_tax: 23.32, stripe_balance_txn_id: "txn_1",
  },
  expenses: {
    id: "gas-1", date: "2026-09-03", category: "materiales", description: "Céramique",
    amount: 862.50, projects: { name: "Obra Laurier" },
  },
  payroll_runs: {
    id: "nom-1", worker_name: "Jean Tremblay", subcontractor_id: null,
    period_start: "2026-08-24", period_end: "2026-08-30",
    // El neto lleva dentro los gastos devueltos: 1600 - 420,50 + 45.
    gross: 1600, employee_deductions: 420.5, employer_contributions: 210.25, net: 1224.5,
    // Las líneas traen las dos partes, la del trabajador y la del empleador,
    // que es como las guarda el sistema.
    lines: [
      { label: "RRQ", paidBy: "empleado", amount: 100.5, remitTo: "revenu_quebec" },
      { label: "RQAP", paidBy: "empleado", amount: 20, remitTo: "revenu_quebec" },
      { label: "Impôt fédéral", paidBy: "empleado", amount: 300, remitTo: "arc" },
      { label: "RRQ employeur", paidBy: "empleador", amount: 100.5, remitTo: "revenu_quebec" },
      { label: "RQAP employeur", paidBy: "empleador", amount: 28, remitTo: "revenu_quebec" },
      { label: "AE employeur", paidBy: "empleador", amount: 81.75, remitTo: "arc" },
    ],
    adjustments: [{ label: "Essence", amount: 45, taxable: false }],
  },
};
admin = hacerAdmin(filas);

const paso = async (nombre, fn) => {
  const antes = enviados.length;
  try { await fn(); } catch (e) { fallos.push(`${nombre} lanzó: ${e.message}`); }
  return enviados.slice(antes);
};

// ---------- 1. Factura ----------
const docsFactura = await paso("factura", () => sync.enviarFactura(admin, NEGOCIO, "fac-1"));
const factura = docsFactura.find((d) => d.entidad === "invoice")?.cuerpo;
comprobar("La factura sale hacia QuickBooks", !!factura);
if (factura) {
  comprobar("Lleva nuestro número de factura", factura.DocNumber === "2026-0001", factura.DocNumber);
  const linea = factura.Line?.[0];
  comprobar("El importe de la línea es el trabajo sin impuestos",
    Number(linea?.Amount) === 5000, dinero(linea?.Amount));
  comprobar("La línea lleva código de impuesto (lo calcula QuickBooks)",
    !!linea?.SalesItemLineDetail?.TaxCodeRef?.value, linea?.SalesItemLineDetail?.TaxCodeRef?.value);
  comprobar("No manda TxnTaxDetail (rompería el cálculo automático)", !("TxnTaxDetail" in factura));
  comprobar("GlobalTaxCalculation = TaxExcluded", factura.GlobalTaxCalculation === "TaxExcluded", factura.GlobalTaxCalculation);
  comprobar("El concepto nombra la obra", String(linea?.Description).includes("Obra Laurier"), linea?.Description);
}

// ---------- 2. Cobro con tarjeta, con retención ----------
const docsPago = await paso("cobro", () => sync.enviarPago(admin, NEGOCIO, "pag-1"));
const pago = docsPago.find((d) => d.entidad === "payment")?.cuerpo;
comprobar("El cobro sale hacia QuickBooks", !!pago);
if (pago) {
  comprobar("El cobro es el total menos la retención del 10 %",
    Number(pago.TotalAmt) === 5248.75, dinero(pago.TotalAmt));
  comprobar("Queda enganchado a su factura",
    pago.Line?.[0]?.LinkedTxn?.[0]?.TxnType === "Invoice" && !!pago.Line?.[0]?.LinkedTxn?.[0]?.TxnId,
    pago.Line?.[0]?.LinkedTxn?.[0]?.TxnId);
  comprobar("Con tarjeta, entra en la cuenta bancaria y no en fondos sin depositar",
    !!pago.DepositToAccountRef?.value, pago.DepositToAccountRef?.value);
  comprobar("Deja escrito con qué se cobró", String(pago.PrivateNote ?? "").includes("stripe"), pago.PrivateNote);
}

// ---------- 3. Nota de crédito ----------
const docsNota = await paso("nota de crédito", () => sync.enviarNotaDeCredito(admin, NEGOCIO, "nc-1"));
const nota = docsNota.find((d) => d.entidad === "creditmemo")?.cuerpo;
comprobar("La nota de crédito sale hacia QuickBooks", !!nota);
if (nota) {
  comprobar("Su importe es el del abono", Number(nota.Line?.[0]?.Amount) === 500, dinero(nota.Line?.[0]?.Amount));
  comprobar("La nota también lleva código de impuesto",
    !!nota.Line?.[0]?.SalesItemLineDetail?.TaxCodeRef?.value);
  comprobar("No manda TxnTaxDetail", !("TxnTaxDetail" in nota));
}

// ---------- 4. Gasto ----------
const docsGasto = await paso("gasto", () => sync.enviarGasto(admin, NEGOCIO, "gas-1"));
const gasto = docsGasto.find((d) => d.entidad === "purchase")?.cuerpo;
comprobar("El gasto sale hacia QuickBooks", !!gasto);
if (gasto) {
  const total = (gasto.Line ?? []).reduce((s, l) => s + Number(l.Amount ?? 0), 0);
  comprobar("El importe del gasto cuadra", Math.abs(total - 862.5) < 0.005, dinero(total));
}

// ---------- 5. Comisión de Stripe ----------
const docsFee = await paso("comisión", () => sync.enviarComisionDeStripe(admin, NEGOCIO, "pag-1"));
const fee = docsFee[0]?.cuerpo;
comprobar("La comisión de Stripe sale hacia QuickBooks", !!fee, docsFee[0]?.entidad);
if (fee) {
  const total = (fee.Line ?? []).reduce((s, l) => s + Number(l.Amount ?? 0), 0);
  comprobar("La comisión apuntada es la que Stripe se quedó",
    Math.abs(total - 155.71) < 0.02 || Math.abs(total - (155.71 + 23.32)) < 0.02, dinero(total));
}

// ---------- 6. Nómina ----------
const docsNomina = await paso("nómina", () => sync.enviarNomina(admin, NEGOCIO, "nom-1"));
const asiento = docsNomina.find((d) => d.entidad === "journalentry")?.cuerpo;
comprobar("La nómina sale como asiento", !!asiento);
if (asiento) {
  const deb = asiento.Line.filter((l) => l.JournalEntryLineDetail.PostingType === "Debit")
    .reduce((s, l) => s + Number(l.Amount), 0);
  const cre = asiento.Line.filter((l) => l.JournalEntryLineDetail.PostingType === "Credit")
    .reduce((s, l) => s + Number(l.Amount), 0);
  comprobar("El asiento cuadra: debe = haber",
    Math.abs(deb - cre) < 0.005, `debe ${dinero(deb)} / haber ${dinero(cre)}`);
  comprobar("Las retenciones van separadas por destino",
    asiento.Line.some((l) => String(l.Description).includes("revenu_quebec")) &&
    asiento.Line.some((l) => String(l.Description).includes("arc")));
  comprobar("Una nómina no lleva impuesto sobre las ventas",
    asiento.GlobalTaxCalculation === "NotApplicable", asiento.GlobalTaxCalculation);
}

// ---------- 7. Quien ya lleva su nómina en QuickBooks Payroll ----------
filas.businesses = { id: NEGOCIO, province: "QC", payroll_in_quickbooks: true };
const admin2 = hacerAdmin({ ...filas, quickbooks_links: () => null });
const antes = enviados.length;
await sync.enviarNomina(admin2, NEGOCIO, "nom-1");
comprobar("Si su nómina la lleva QuickBooks Payroll, no se duplica",
  enviados.length === antes, `${enviados.length - antes} documentos`);

console.log("\n=== LO QUE CUADRA ===");
for (const b of bien) console.log("  ok  " + b);
console.log("\n=== LO QUE NO ===");
if (!fallos.length) console.log("  (nada)");
for (const f of fallos) console.log("  XX  " + f);
console.log(`\n${bien.length} bien, ${fallos.length} mal\n`);
