// Los casos raros. Una integración contable no se rompe con la factura
// normal: se rompe con la nómina sin líneas, el cobro a plazos y el
// subcontratista.
import { sync, enviados, hacerAdmin } from "./correr.mjs";

const N = "neg-1";
const out = [];
const di = (q, ok, d) => out.push(`${ok ? "ok " : "XX "} ${q}${d ? ` — ${d}` : ""}`);
const eur = (x) => `${Number(x).toFixed(2)} $`;

function nuevoAdmin(extra = {}) {
  let a;
  const filas = {
    quickbooks_links: (f) => {
      const s = a.escrituras.filter((e) => e.tabla === "quickbooks_links" && e.fila.kind === f.kind && e.fila.local_id === f.local_id);
      return s.length ? s[s.length - 1].fila : null;
    },
    businesses: { id: N, province: "QC", payroll_in_quickbooks: false },
    clients: { id: "cli-1", name: "Client Test inc." },
    invoices: { id: "fac-1", number: "2026-0001", client_id: "cli-1", created_at: "2026-09-01", subtotal: 5000, status: "emitido" },
    ...extra,
  };
  a = hacerAdmin(filas);
  return a;
}
const desde = () => enviados.length;
const nuevos = (n) => enviados.slice(n);

// 1. Nómina cuyas líneas de retención se perdieron: ¿sale un asiento roto?
{
  const a = nuevoAdmin({
    payroll_runs: { id: "n1", worker_name: "X", subcontractor_id: null, period_start: "2026-08-24",
      period_end: "2026-08-30", gross: 1600, employee_deductions: 420.5, employer_contributions: 210.25,
      net: 1179.5, lines: null, adjustments: null },
  });
  const i = desde();
  let lanzo = null;
  try { await sync.enviarNomina(a, N, "n1"); } catch (e) { lanzo = e.message; }
  const j = nuevos(i).find((d) => d.entidad === "journalentry")?.cuerpo;
  if (!j) {
    di("Nómina sin líneas: no manda nada", true, lanzo ? `se paró: ${lanzo}` : "no envió");
  } else {
    const deb = j.Line.filter((l) => l.JournalEntryLineDetail.PostingType === "Debit").reduce((s, l) => s + Number(l.Amount), 0);
    const cre = j.Line.filter((l) => l.JournalEntryLineDetail.PostingType === "Credit").reduce((s, l) => s + Number(l.Amount), 0);
    di("Nómina sin líneas: el asiento sigue cuadrando", Math.abs(deb - cre) < 0.005, `debe ${eur(deb)} / haber ${eur(cre)}`);
  }
}

// 2. Subcontratista: no es nómina, es una compra.
{
  const a = nuevoAdmin({
    payroll_runs: { id: "n2", worker_name: "Sous-traitant inc.", subcontractor_id: "sub-1",
      period_start: "2026-08-24", period_end: "2026-08-30", gross: 3000, employee_deductions: 0,
      employer_contributions: 0, net: 3000, lines: [], adjustments: null },
  });
  const i = desde();
  try { await sync.enviarNomina(a, N, "n2"); } catch (e) { di("Subcontratista lanzó", false, e.message); }
  const d = nuevos(i);
  di("Un subcontratista va como compra, no como nómina",
    d.some((x) => x.entidad === "purchase") && !d.some((x) => x.entidad === "journalentry"),
    d.map((x) => x.entidad).join(", ") || "nada");
}

// 3. Cobro a plazos: dos pagos parciales sobre la misma factura.
{
  const a = nuevoAdmin({
    payments: (f) => ({
      "p1": { id: "p1", invoice_id: "fac-1", amount: 2000, paid_at: "2026-09-05", method: "transferencia", reference: "vir-1", invoices: { client_id: "cli-1" } },
      "p2": { id: "p2", invoice_id: "fac-1", amount: 3248.75, paid_at: "2026-09-20", method: "transferencia", reference: "vir-2", invoices: { client_id: "cli-1" } },
    })[f.id] ?? null,
  });
  const i = desde();
  await sync.enviarPago(a, N, "p1");
  await sync.enviarPago(a, N, "p2");
  const pagos = nuevos(i).filter((x) => x.entidad === "payment").map((x) => x.cuerpo);
  di("Dos cobros parciales llegan como dos cobros", pagos.length === 2, `${pagos.length}`);
  di("Los dos apuntan a la misma factura",
    pagos.length === 2 && pagos[0].Line[0].LinkedTxn[0].TxnId === pagos[1].Line[0].LinkedTxn[0].TxnId);
  di("La factura solo se creó una vez",
    nuevos(i).filter((x) => x.entidad === "invoice").length === 1,
    `${nuevos(i).filter((x) => x.entidad === "invoice").length}`);
  di("Sin tarjeta no se fuerza la cuenta bancaria",
    pagos.every((p) => !p.DepositToAccountRef), "correcto: lo elige QuickBooks");
}

// 4. Factura anulada: no debe existir allí.
{
  const a = nuevoAdmin({ invoices: { id: "fac-1", number: "2026-0009", client_id: "cli-1", created_at: "2026-09-01", subtotal: 800, status: "cancelado" } });
  const i = desde();
  await sync.enviarFactura(a, N, "fac-1");
  di("Una factura anulada no se manda", !nuevos(i).some((x) => x.entidad === "invoice"));
}

// 5. Reenviar dos veces la misma factura: no puede duplicarse.
{
  const a = nuevoAdmin();
  const i = desde();
  await sync.enviarFactura(a, N, "fac-1");
  await sync.enviarFactura(a, N, "fac-1");
  di("Reenviar no duplica la factura", nuevos(i).filter((x) => x.entidad === "invoice").length === 1,
    `${nuevos(i).filter((x) => x.entidad === "invoice").length} facturas`);
}

// 6. QuickBooks sin ningún código de impuesto: hay que explicarlo, no callar.
{
  const a = nuevoAdmin();
  const { enviados: _e } = await import("./stub-quickbooks.js");
  globalThis.__sinImpuesto = true;
  let msg = null;
  try { await sync.enviarFactura(a, N, "fac-1"); } catch (e) { msg = e.message; }
  globalThis.__sinImpuesto = false;
  di("Sin código de impuesto, el aviso dice dónde arreglarlo",
    !!msg && /Taxes/i.test(msg), msg ? msg.slice(0, 90) : "no lanzó");
}

// 7. Una obra de Quebec en un QuickBooks que sólo tiene el impuesto de Ontario.
//    Aceptarlo es lo que dejó una factura con HST del 13 % en los libros de
//    un contratista quebequés, y con «enviado» en verde en nuestra pantalla.
{
  const a = nuevoAdmin();
  globalThis.__soloOntario = true;
  const i = desde();
  let msg = null;
  try { await sync.enviarFactura(a, N, "fac-1"); } catch (e) { msg = e.message; }
  globalThis.__soloOntario = false;
  di("Sin el impuesto de su provincia, no se usa el de otra",
    !nuevos(i).some((x) => x.entidad === "invoice"), msg ? "no se mandó" : "SE MANDÓ");
  di("Y el aviso dice qué provincia falta y dónde crearlo",
    !!msg && /QC/.test(msg) && /Taxes/i.test(msg), msg ? msg.slice(0, 110) : "no lanzó");
}

console.log(out.join("\n"));
console.log(`\n${out.filter((x) => x.startsWith("ok")).length} bien, ${out.filter((x) => x.startsWith("XX")).length} mal\n`);
