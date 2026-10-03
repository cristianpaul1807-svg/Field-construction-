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
import { registrarEjecutor } from "../../../server/mcpAcciones";
import { DATOS, ESCRITO } from "./supabaseFalso";

const futuro = new Date(Date.now() + 3600e3).toISOString();
function negocio(country: string, province: string, extra: any = {}) {
  DATOS.employees = []; DATOS.subcontractors = []; DATOS.users = [];
  DATOS.mcp_oauth_tokens = [{ connection_id: "c1", scope: extra.scope ?? "mcp:read", resource: "x", access_expires_at: futuro, revoked_at: null, mcp_connections: { business_id: "b1", employee_id: null, subcontractor_id: null, owner_auth_user_id: "u1", status: "active" } }];
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
  ok(`${pais}: congruità`, nombres.includes("check_congruita"), pais === "IT");
  ok(`${pais}: en solo lectura no hay nada que prepare`, nombres.filter((n: string) => n.startsWith("draft_") || n.endsWith("_action")), []);
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
    DATOS.invoices = [{ number: "2026-0004", amount: 13750, paid_at: "2026-09-20", projects: { name: "Via Roma", bonus_fiscale: "ristrutturazione" }, clients: { name: "Mario" } }];
    const ritenute = await llamar("get_bank_withholdings", { year: 2026 });
    ok("IT: lo que retuvieron los bancos en el año", [ritenute.total, ritenute.invoices?.[0]?.withholding, ritenute.currency], [1239.75, 1239.75, "EUR"]);
    // Un DURC vencido ayer y un curso que vence dentro de un año: ambos
    // vuelven (el filtro de fechas lo hace la base, que aquí no filtra),
    // pero cada uno con sus días contados desde hoy en Roma.
    const ayer = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
    DATOS.worker_documents = [{ id: "d1", kind: "durc", name: "durc.pdf", expires_on: ayer, employee_id: null, subcontractor_id: "s1", employees: null, subcontractors: { name: "Bianchi Srl" } }];
    const vencen = await llamar("get_expiring_documents", {});
    ok("IT: el DURC del subcontratista, vencido ayer", [vencen.documents?.[0]?.kind, vencen.documents?.[0]?.daysLeft, vencen.documents?.[0]?.personName], ["durc", -1, "Bianchi Srl"]);
    // Una reforma de 90.000 € más 10.000 de extras pide un 22 % de mano de
    // obra: 22.000 €. Con 16 h a 30 €/h faltan 21.520; las 4 h del
    // subcontratista sin coste no suman y se dicen aparte.
    DATOS.projects = [{ id: "p1", congruita_categoria: "ristrutturazione_civile", lavoro_pubblico: false, valore_opera: null, estimates: { total: 90000 } }];
    DATOS.change_orders = [{ amount: 10000 }];
    DATOS.employees = [{ id: "e1", hourly_rate: 30 }];
    DATOS.subcontractors = [{ id: "s1", hourly_rate: null }];
    DATOS.time_entries = [
      { employee_id: "e1", subcontractor_id: null, check_in_time: "2026-09-01T06:00:00Z", check_out_time: "2026-09-01T14:00:00Z" },
      { employee_id: "e1", subcontractor_id: null, check_in_time: "2026-09-02T06:00:00Z", check_out_time: "2026-09-02T14:00:00Z" },
      { employee_id: null, subcontractor_id: "s1", check_in_time: "2026-09-02T06:00:00Z", check_out_time: "2026-09-02T10:00:00Z" },
    ];
    const cg = await llamar("check_congruita", { projectId: "11111111-1111-4111-8111-111111111111" });
    ok("IT: congruità de una reforma de 100.000 €", [cg.estado, cg.valoreOpera, cg.minima, cg.manodopera, cg.falta, cg.oreSenzaCosto, cg.currency], ["non_congrua", 100000, 22000, 480, 21520, 4, "EUR"]);
    // Un SAL ya certificado al 40 % sobre un presupuesto de 10.000 de coste
    // con un 10 % de margen: 11.000 de contrato, 4.400 certificados.
    DATOS.projects = [{ id: "p1", client_id: "k1", estimate_id: "est1", estimates: { id: "est1", margin_percent: 10, waste_percent: 0 } }];
    DATOS.estimate_lines = [{ id: "l1", zone: "Bagno", item_name: "Piastrelle", quantity: 20, total: 10000 }];
    DATOS.change_orders = [];
    DATOS.sal = [{ id: "s1", numero: 1, data: "2026-09-30", avanzamento: { "l:l1": 40 }, importo_cumulato: 4400, importo: 4400, recupero_acconto: 0, note: null, invoice_id: null }];
    DATOS.invoices = [];
    const sal = await llamar("get_progress_claims", { projectId: "11111111-1111-4111-8111-111111111111" });
    ok("IT: lo certificado de la obra", [sal.contractValue, sal.certifiedToDate, sal.items?.[0]?.percentComplete, sal.claims?.length, sal.currency], [11000, 4400, 40, 1, "EUR"]);
    ok("IT: clientes sin la llave del portal", Object.keys((await llamar("get_clients", { search: "Bian" })).clients[0]).includes("access_token"), false);
  }
  if (pais === "ES") {
    const c = await llamar("calculate_invoice", { subtotal: 1000, type: "deposito" });
    ok("ES: calcular una factura no existe", c.error?.code, "not_found");
  }
}
const escrituras = ESCRITO.filter((e) => !["mcp_audit_log", "mcp_connections"].includes(e.tabla));
ok("Nada escribió fuera de la auditoría", escrituras, []);

// ---------- Fase B: el propietario que concedió `mcp:write` ----------
// Los ejecutores de verdad son los del panel y se registran en api.ts; aquí
// uno que apunta cuántas veces lo llamaron, que es lo que importa: una.
const emitidas: any[] = [];
registrarEjecutor("factura", async (_admin, _quien, datos) => { emitidas.push(datos); return { ok: true, detalle: { invoiceNumber: "2026-0001" } }; });
negocio("CA", "QC", { holdback: 10, scope: "mcp:read mcp:write" });
DATOS.businesses[0].primary_auth_user_id = "u1";
DATOS.mcp_acciones = [];
const conEscritura = ((await rpc("tools/list")).result?.tools ?? []).map((t: any) => t.name);
ok("Escritura: ve las herramientas de preparar", ["draft_invoice", "draft_payment", "draft_estimate", "confirm_action", "cancel_action"].every((n) => conEscritura.includes(n)), true);
DATOS.projects = [];
const b = await llamar("draft_invoice", { subtotal: 10000, type: "deposito", clientId: "11111111-1111-4111-8111-111111111111" });
ok("Escritura: el borrador dice exactamente lo que va a emitir", [b.summary?.client, b.summary?.taxAmount, b.summary?.amountDue, b.summary?.currency], ["Mario Bianchi", 1497.5, 10497.5, "CAD"]);
ok("Escritura: preparar no emite", emitidas.length, 0);
ok("Escritura: preparar no escribe en ninguna tabla de negocio", ESCRITO.filter((e) => !["mcp_audit_log", "mcp_connections", "mcp_acciones"].includes(e.tabla)), []);
const c1 = await llamar("confirm_action", { actionId: b.actionId });
ok("Escritura: confirmar emite", [c1.done, c1.result?.invoiceNumber, emitidas.length], [true, "2026-0001", 1]);
const c2 = await llamar("confirm_action", { actionId: b.actionId });
ok("Escritura: confirmar dos veces no emite dos", [c2.error?.code, emitidas.length], ["action_already_done", 1]);
const b2 = await llamar("draft_invoice", { subtotal: 500, type: "parcial", clientId: "11111111-1111-4111-8111-111111111111" });
ok("Escritura: cancelar", (await llamar("cancel_action", { actionId: b2.actionId })).cancelled, true);
ok("Escritura: lo cancelado ya no se confirma", [(await llamar("confirm_action", { actionId: b2.actionId })).error?.code, emitidas.length], ["action_cancelled", 1]);
const b3 = await llamar("draft_invoice", { subtotal: 700, type: "parcial", clientId: "11111111-1111-4111-8111-111111111111" });
DATOS.mcp_acciones.find((a) => a.id === b3.actionId).expira_en = new Date(Date.now() - 1000).toISOString();
ok("Escritura: un borrador caducado no se confirma", [(await llamar("confirm_action", { actionId: b3.actionId })).error?.code, emitidas.length], ["action_expired", 1]);
// El mismo permiso en una cuenta que ya no es suya: la escritura se comprueba
// en cada llamada, no viaja con la conexión.
DATOS.businesses[0].primary_auth_user_id = "otro";
DATOS.users = [{ auth_user_id: "u1", business_id: "b1", roles: { name: "admin", permissions: null } }];
const sinSerDueño = ((await rpc("tools/list")).result?.tools ?? []).map((t: any) => t.name);
ok("Escritura: sin ser el propietario principal no hay nada que prepare", sinSerDueño.filter((n: string) => n.startsWith("draft_") || n.endsWith("_action")), []);
srv.close();
console.log(`\n${mal ? "HAY FALLOS" : "todo bien"}`);
process.exit(mal ? 1 : 0);
