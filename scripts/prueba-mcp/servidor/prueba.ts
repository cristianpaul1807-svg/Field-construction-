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
