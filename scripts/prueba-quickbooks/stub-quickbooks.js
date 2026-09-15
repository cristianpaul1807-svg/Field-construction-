// El doble de `server/quickbooks.ts`. Graba lo que se habría mandado a Intuit
// en vez de mandarlo, y devuelve lo que Intuit devolvería.
export const enviados = [];

export class QuickBooksSinConectar extends Error {
  code = "quickbooks_not_connected";
}

let contador = 0;

export async function llamar(admin, businessId, ruta, opciones) {
  const entidad = ruta.split("?")[0];
  // Las lecturas que hace el código para resolver ids (impuestos, cuentas,
  // servicio) se contestan aquí como las contestaría un QuickBooks canadiense.
  if (entidad === "query") {
    const q = decodeURIComponent(ruta).toLowerCase();
    if (q.includes("from taxcode")) {
      if (globalThis.__sinImpuesto) return { QueryResponse: {} };
      // Lo que tiene una empresa canadiense recién creada: el impuesto de
      // Ontario y nada de Quebec. Es exactamente el caso que mandó una obra
      // de Quebec con HST del 13 %.
      if (globalThis.__soloOntario) {
        return {
          QueryResponse: {
            TaxCode: [
              { Id: "TAX-HST-ON", Name: "HST ON", Active: true,
                SalesTaxRateList: { TaxRateDetail: [{ TaxRateRef: { value: "9", name: "HST 13%" } }] },
                PurchaseTaxRateList: { TaxRateDetail: [{ TaxRateRef: { value: "9", name: "HST 13%" } }] } },
            ],
          },
        };
      }
      return {
        QueryResponse: {
          TaxCode: [
            { Id: "TAX-GST-QST", Name: "GST/QST QC - 14.975", Active: true,
              SalesTaxRateList: { TaxRateDetail: [
                { TaxRateRef: { value: "1", name: "GST 5%" } },
                { TaxRateRef: { value: "2", name: "QST 9.975%" } }] },
              PurchaseTaxRateList: { TaxRateDetail: [
                { TaxRateRef: { value: "1", name: "GST 5%" } },
                { TaxRateRef: { value: "2", name: "QST 9.975%" } }] } },
          ],
        },
      };
    }
    if (q.includes("from item")) return { QueryResponse: { Item: [{ Id: "ITEM-1" }] } };
    if (q.includes("from account")) return { QueryResponse: { Account: [{ Id: "ACC-1" }] } };
    return { QueryResponse: {} };
  }
  if (opciones?.method === "POST") {
    contador += 1;
    const id = `${entidad.toUpperCase()}-${contador}`;
    enviados.push({ entidad, cuerpo: opciones.body });
    const clave = { invoice: "Invoice", creditmemo: "CreditMemo", payment: "Payment",
      estimate: "Estimate", purchase: "Purchase", journalentry: "JournalEntry",
      customer: "Customer", item: "Item" }[entidad] ?? "Entity";
    return { [clave]: { Id: id, SyncToken: "0" } };
  }
  return {};
}
