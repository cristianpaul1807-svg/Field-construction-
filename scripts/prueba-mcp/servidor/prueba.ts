/**
 * El servidor MCP de verdad, con una base de datos de mentira.
 *
 * Las otras pruebas de `scripts/prueba-mcp/` miran la tabla de permisos; ésta
 * arranca `mcpHandler` con el SDK de verdad, le pide `tools/list` y llama a las
 * herramientas como lo haría Claude, para un negocio de Canadá, uno de Italia
 * y uno de un país sin configurar. Comprueba lo que la tabla sola no puede:
 * que cada importe sale con su moneda, que la factura calculada da la misma
 * cifra que la emitida, y que nada escribe fuera de la auditoría.
 *
 * Se arranca con `node scripts/prueba-mcp/servidor.mjs`.
 */
import express from "express";
import { mcpHandler } from "../../../server/mcp";
import { DATOS, ESCRITO } from "./supabaseFalso";

const futuro = new Date(Date.now() + 3600e3).toISOString();
function negocio(country: string, province: string, extra: any = {}) {
  DATOS.employees = []; DATOS.subcontractors = []; DATOS.users = [];
  DATOS.mcp_oauth_tokens = [{ connection_id: "c1", scope: "mcp:read", resource: "x", access_expires_at: futuro, revoked_at: null, mcp_connections: { business_id: "b1", employee_id: null, subcontractor_id: null, owner_auth_user_id: "u1", status: "active" } }];
  DATOS.businesses = [{ id: "b1", name: "Negocio", subscription_plan: "entreprise", subscription_status: "active", trial_ends_at: null, country, province, tax_config: extra.tax_config ?? null, holdback_percent: extra.holdback ?? 0 }];
  DATOS.canada_tax_rates = [{ province: "QC", label: "Québec", is_hst: false, gst_rate: 0.05, pst_rate: 0.09975, hst_rate: 0 }];
  DATOS.invoices = [];
  DATOS.clients = [{ id: "k1", name: "Mario Bianchi", partita_iva: null }];
}

const app = express();
app.use(express.json());
app.post("/mcp", mcpHandler);
const srv = app.listen(0);
const url = `http://127.0.0.1:${(srv.address() as any).port}/mcp`;
let id = 0;
async function rpc(method: string, params: any = {}) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: "Bearer tok" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
  const t = await r.text();
  const linea = t.split("\n").find((l) => l.startsWith("data:"));
  return JSON.parse(linea ? linea.slice(5) : t);
}
const llamar = async (name: string, args: any = {}) => {
  const r = await rpc("tools/call", { name, arguments: args });
  const texto = r.result?.content?.[0]?.text ?? "";
  if (r.result?.isError) { try { return { error: JSON.parse(texto) }; } catch { return { error: { code: "not_found", text: texto } }; } }
  return r.result ? JSON.parse(texto) : r;
};

let mal = 0;
const ok = (que: string, real: any, esperado: any) => { const i = JSON.stringify(real) === JSON.stringify(esperado); console.log(`${i ? "ok " : "MAL"} ${que}${i ? "" : ` — esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`}`); if (!i) mal++; };

for (const [pais, prov, extra] of [["CA", "QC", { holdback: 10 }], ["IT", "RM", { tax_config: { ivaPredefinita: "10" } }], ["ES", "", {}]] as const) {
  negocio(pais, prov, extra);
  const lista = await rpc("tools/list");
  const nombres = (lista.result?.tools ?? []).map((t: any) => t.name);
  console.log(`\n== ${pais}: ${nombres.length} herramientas`);
  if (process.env.VER) console.log(nombres.join(" "));
  ok(`${pais}: QuickBooks`, nombres.includes("audit_quickbooks_sync"), pais === "CA");
  ok(`${pais}: calcular factura`, nombres.includes("calculate_invoice"), pais !== "ES");
  ok(`${pais}: Partita IVA`, nombres.includes("check_italian_tax_id"), pais === "IT");
  ok(`${pais}: títulos sin francés`, (lista.result?.tools ?? []).filter((t: any) => /[éèàç]|Mes |Mon /.test(t.title ?? "")).map((t: any) => t.title), []);
  const resumen = await llamar("get_business_summary");
  ok(`${pais}: el resumen dice la moneda`, resumen.business?.currency, pais === "CA" ? "CAD" : "EUR");
  const facturas = await llamar("get_invoices");
  ok(`${pais}: las facturas dicen la moneda`, facturas.currency, pais === "CA" ? "CAD" : "EUR");
  if (pais === "CA") {
    const c = await llamar("calculate_invoice", { subtotal: 10000, type: "deposito" });
    ok("CA: 10.000 de depósito en Quebec con retención del 10 %", [c.taxBreakdown.gst, c.taxBreakdown.pst, c.taxAmount, c.holdbackWithheld, c.amountDue, c.saved], [500, 997.5, 1497.5, 1000, 10497.5, false]);
  }
  if (pais === "IT") {
    const c = await llamar("calculate_invoice", { subtotal: 12500, type: "deposito" });
    ok("IT: el IVA habitual del negocio (10 %)", [c.taxAmount, c.amountDue, c.currency], [1250, 13750, "EUR"]);
    const rc = await llamar("calculate_invoice", { subtotal: 12500, type: "deposito", iva: "rc" });
    ok("IT: inversione contabile", [rc.taxAmount, rc.taxBreakdown.natura], [0, "N6.3"]);
    ok("IT: Partita IVA buena", (await llamar("check_italian_tax_id", { value: "IT 06363391001" })).valid, true);
    ok("IT: Partita IVA mal tecleada", (await llamar("check_italian_tax_id", { value: "06363391002" })).valid, false);
    // Un mes de un muratore: un día de 9 h (8 + 1 extra), un fichaje sin
    // aprobar que no cuenta y dos días de mal tiempo.
    DATOS.employees = [{ id: "e1", name: "Luca Rossi", role: "Muratore" }];
    DATOS.time_entries = [
      { employee_id: "e1", check_in_time: "2026-09-01T06:00:00Z", check_out_time: "2026-09-01T14:00:00Z", overtime: false, approved: true },
      { employee_id: "e1", check_in_time: "2026-09-01T14:00:00Z", check_out_time: "2026-09-01T15:00:00Z", overtime: true, approved: true },
      { employee_id: "e1", check_in_time: "2026-09-04T06:00:00Z", check_out_time: "2026-09-04T14:00:00Z", overtime: false, approved: false },
    ];
    DATOS.time_off = [{ employee_id: "e1", start_date: "2026-09-02", end_date: "2026-09-03", kind: "maltempo" }];
    const horas = await llamar("get_monthly_hours", { month: "2026-09" });
    const luca = horas.personas?.[0];
    ok("IT: horas del mes para el consulente", [luca?.totales.ordinarias, luca?.totales.extraordinarias, luca?.totales.ausencias.maltempo, horas.sinAprobar, horas.zonaHoraria], [8, 1, 2, 1, "Europe/Rome"]);
    ok("IT: el detalle va por día", [luca?.dias["2026-09-01"].ordinarias, luca?.dias["2026-09-02"].ausencia], [8, "maltempo"]);
    // La factura electrónica: con datos completos sale el XML; sin la
    // dirección del cliente, la lista de lo que falta.
    DATOS.businesses[0] = { ...DATOS.businesses[0], partita_iva: "06363391001", codice_fiscale: null, address_line: "Via Roma 12", postal_code: "00144", city: "Roma", province: "RM", regime_fiscale: "RF01" };
    const facturaIt = { id: "11111111-1111-4111-8111-111111111111", number: "2026-0004", type: "deposito", status: "pendiente", description: "Acconto", subtotal: 12500, tax_breakdown: { country: "IT", ivaAliquota: 10, iva: 1250 }, holdback_amount: 0, holdback_released: 0, amount: 13750, due_date: null, created_at: "2026-09-10T10:00:00Z", client_id: "k1", projects: null };
    DATOS.invoices = [{ ...facturaIt, clients: { name: "Bianchi S.p.A.", partita_iva: "01234567897", codice_destinatario: "M5UXCR1", address_line: "Corso Italia 4", postal_code: "20122", city: "Milano", region: "MI" } }];
    const xml = await llamar("get_e_invoice", { id: facturaIt.id });
    ok("IT: el XML de la factura, con su nombre de archivo", [/^IT06363391001_[0-9A-Z]{5}\.xml$/.test(xml.fileName ?? ""), /<TipoDocumento>TD02</.test(xml.xml ?? "")], [true, true]);
    DATOS.invoices = [{ ...facturaIt, clients: { name: "Bianchi S.p.A.", partita_iva: "01234567897", address_line: "", postal_code: null, city: "Milano" } }];
    const sinDatos = await llamar("get_e_invoice", { id: facturaIt.id });
    ok("IT: sin la dirección del cliente, dice qué falta", sinDatos.error?.faltan?.cliente, ["indirizzo", "cap"]);
    ok("IT: clientes sin la llave del portal", Object.keys((await llamar("get_clients", { search: "Bian" })).clients[0]).includes("access_token"), false);
  }
  if (pais === "ES") {
    const c = await llamar("calculate_invoice", { subtotal: 1000, type: "deposito" });
    ok("ES: calcular una factura no existe", c.error?.code, "not_found");
  }
}
const escrituras = ESCRITO.filter((e) => !["mcp_audit_log", "mcp_connections"].includes(e.tabla));
ok("Nada escribió fuera de la auditoría", escrituras, []);
srv.close();
console.log(`\n${mal ? "HAY FALLOS" : "todo bien"}`);
process.exit(mal ? 1 : 0);
