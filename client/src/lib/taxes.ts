/**
 * El impuesto que verá el cliente, calculado donde se está editando.
 *
 * Quien manda es el servidor: `computeInvoiceTax` es lo que acaba en la
 * factura y en el PDF. Esto existe sólo porque el constructor de presupuestos
 * recalcula el total en vivo mientras se tocan líneas y margen, y el
 * contratista tiene que ver moverse la cifra final —la que va a decir por
 * teléfono— y no una anterior a impuestos.
 *
 * La fórmula es la misma a propósito, y por eso está sola en un archivo: si un
 * día cambia una tasa o una regla de redondeo, que haya un solo sitio donde
 * mirar además del servidor.
 */

export interface TaxRate {
  province: string;
  label: string;
  isHst: boolean;
  gstRate: number;
  pstRate: number;
  hstRate: number;
}

export interface TaxPreview {
  /** Cada impuesto con su nombre y su importe, en el orden en que se declara. */
  parts: { label: string; amount: number }[];
  taxAmount: number;
  total: number;
}

/** Al céntimo, una sola vez y en el momento en que se convierte en algo que
 *  alguien lee — igual que el resto del dinero de este producto. */
const round = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number) => `${Number((n * 100).toFixed(3))} %`;

export function previewTax(subtotal: number, rate: TaxRate | null): TaxPreview {
  if (!rate) return { parts: [], taxAmount: 0, total: round(subtotal) };

  if (rate.isHst) {
    const hst = round(subtotal * rate.hstRate);
    return { parts: [{ label: `TVH/HST ${pct(rate.hstRate)}`, amount: hst }], taxAmount: hst, total: round(subtotal + hst) };
  }

  const gst = round(subtotal * rate.gstRate);
  const parts = [{ label: `TPS/GST ${pct(rate.gstRate)}`, amount: gst }];
  let taxAmount = gst;

  if (rate.pstRate > 0) {
    const pst = round(subtotal * rate.pstRate);
    // En Quebec la TVQ se declara aparte de la TPS, y por eso se enseña
    // aparte: una sola línea de "impuestos" no le sirve a su contable.
    parts.push({ label: rate.province === "QC" ? `TVQ/QST ${pct(rate.pstRate)}` : `PST ${pct(rate.pstRate)}`, amount: pst });
    taxAmount = round(taxAmount + pst);
  }

  return { parts, taxAmount, total: round(subtotal + taxAmount) };
}
