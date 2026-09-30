/**
 * El IVA italiano de una factura de obra.
 *
 * En Canadá el impuesto lo decide la provincia del negocio y es el mismo en
 * todas sus facturas. En Italia no: lo decide **la obra**. Una reforma de una
 * vivienda va al 10 %, la primera vivienda nueva al 4 %, casi todo lo demás al
 * 22 %. Y cuando una empresa del sector subcontrata a otra, la factura va sin
 * IVA —la inversione contabile del art. 17, c. 6, lett. a) del DPR 633/72—:
 * lo ingresa quien la recibe, no quien la emite.
 *
 * Por eso aquí no hay tabla ni región: hay una elección por factura, con la del
 * negocio como punto de partida. El servidor y la pantalla usan esta misma
 * función, para que el total que el contratista ve mientras escribe sea el
 * que acaba en la factura.
 */

export const OPCIONES_IVA = ["22", "10", "4", "rc"] as const;
export type OpcionIva = (typeof OPCIONES_IVA)[number];

/** La que se usa si el negocio no ha dicho otra: el tipo ordinario. */
export const IVA_POR_DEFECTO: OpcionIva = "22";

export function esOpcionIva(valor: unknown): valor is OpcionIva {
  return typeof valor === "string" && (OPCIONES_IVA as readonly string[]).includes(valor);
}

/** Lo que se guarda en `tax_breakdown` de una factura italiana. */
export interface DesgloseIva {
  country: "IT";
  /** El tipo en tanto por ciento, como lo escribe la factura: 22, 10, 4 o 0. */
  ivaAliquota: number;
  iva: number;
  /**
   * La razón de que no lleve IVA, con el código de la factura electrónica.
   * N6.3 es la inversione contabile de los subcontratos del sector de la
   * construcción.
   */
  natura?: "N6.3";
}

/** Al céntimo, una sola vez, como el resto del dinero de este producto. */
const alCentimo = (n: number) => Math.round(n * 100) / 100;

export function calcularIva(subtotal: number, opcion: OpcionIva): { taxAmount: number; breakdown: DesgloseIva } {
  if (opcion === "rc") {
    return { taxAmount: 0, breakdown: { country: "IT", ivaAliquota: 0, iva: 0, natura: "N6.3" } };
  }
  const aliquota = Number(opcion);
  const iva = alCentimo((subtotal * aliquota) / 100);
  return { taxAmount: iva, breakdown: { country: "IT", ivaAliquota: aliquota, iva } };
}

export function esDesgloseIva(desglose: unknown): desglose is DesgloseIva {
  return typeof desglose === "object" && desglose !== null && (desglose as { country?: unknown }).country === "IT";
}
