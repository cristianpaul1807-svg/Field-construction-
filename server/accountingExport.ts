import type { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * The books, in a file an accountant can import.
 *
 * This is the objection that costs a sale. However good the software is, when
 * the contractor takes the year to their accountant the accountant asks for
 * QuickBooks or Sage — and if the answer is a stack of PDFs, somebody types
 * them in at an hourly rate. That cost lands on the customer and it is enough
 * on its own to keep them where they are.
 *
 * CSV rather than a vendor format, deliberately. Every accounting package on
 * earth imports CSV; the native formats are per-vendor, per-version, and
 * fragile. This covers most of the need for a fraction of the work, and the
 * columns are named so a human can map them once and reuse the mapping.
 *
 * Tax is broken out into its own columns. An accountant needs the GST and QST
 * separately to file, and a single "tax" column would send them back to the
 * PDFs — which is the whole thing this exists to avoid.
 */

type Db = ReturnType<typeof getSupabaseAdmin>;

export type ExportKind =
  | "invoices"
  | "credit-notes"
  | "payments"
  | "expenses"
  | "quickbooks-invoices"
  | "quickbooks-customers";

/**
 * El código de impuesto que QuickBooks espera en cada línea.
 *
 * QuickBooks no acepta un importe de impuesto suelto: quiere el **nombre del
 * código** que la empresa tiene dado de alta, y lo recalcula él. Si no
 * coincide con uno que exista en su cuenta, la importación rechaza la línea.
 *
 * Los nombres son los que trae QuickBooks Canadá de fábrica por provincia.
 * Quien haya renombrado los suyos tendrá que ajustarlos al importar, y por eso
 * la pantalla lo avisa en vez de dejarlo descubrir a base de líneas
 * rechazadas.
 */
const CODIGO_DE_IMPUESTO: Record<string, string> = {
  QC: "GST/QST QC",
  ON: "HST ON",
  BC: "GST/PST BC",
  AB: "GST",
  MB: "GST/PST MB",
  SK: "GST/PST SK",
  NS: "HST NS",
  NB: "HST NB",
  NL: "HST NL",
  PE: "HST PE",
  NT: "GST",
  NU: "GST",
  YT: "GST",
};

/**
 * One CSV cell.
 *
 * Quoted whenever it contains a comma, a quote or a newline, with inner quotes
 * doubled — the rule the format actually has, rather than the "just strip the
 * commas" that silently mangles a client called "Dupont, Fils & Cie".
 *
 * A leading =, +, - or @ gets a tab in front. Those characters make a
 * spreadsheet treat the cell as a formula, which is both a mangled name and,
 * with a crafted description, a way to run something on the accountant's
 * machine.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `\t${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // CRLF and a UTF-8 BOM: Excel opens a plain LF UTF-8 file as Latin-1 and
  // turns every accented name into mojibake, which in Quebec is most of them.
  return `﻿${lines.join("\r\n")}\r\n`;
}

const money = (value: unknown) => Number(value ?? 0).toFixed(2);
const day = (value: unknown) => (value ? String(value).slice(0, 10) : "");

export interface ExportResult {
  filename: string;
  csv: string;
  rowCount: number;
}

export async function exportAccounting(
  db: Db,
  businessId: string,
  kind: ExportKind,
  from: string,
  to: string
): Promise<ExportResult> {
  const fromIso = `${from}T00:00:00`;
  const toIso = `${to}T23:59:59.999`;

  if (kind === "invoices") {
    const { data } = await db
      .from("invoices")
      .select(
        "id, created_at, due_date, paid_at, type, charge_kind, status, description, subtotal, tax_amount, tax_breakdown, holdback_amount, holdback_released, amount, clients(name), projects(name), payments(method, reference)"
      )
      .eq("business_id", businessId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at");

    const rows = ((data ?? []) as any[]).map((i) => [
      i.id,
      day(i.created_at),
      day(i.due_date),
      i.clients?.name ?? "",
      i.projects?.name ?? "",
      i.type,
      i.charge_kind,
      i.status,
      i.description ?? "",
      money(i.subtotal),
      money(i.tax_breakdown?.gst),
      money(i.tax_breakdown?.pst),
      money(i.tax_amount),
      money(i.holdback_amount),
      money(i.holdback_released),
      money(i.amount),
      day(i.paid_at),
      // Con qué se cobró. Para el contable no es lo mismo una transferencia
      // que un cargo con tarjeta, y la referencia es lo que le deja casar la
      // línea con el extracto del banco.
      i.payments?.[0]?.method ?? "",
      i.payments?.[0]?.reference ?? "",
    ]);

    return {
      filename: `facturas-${from}-${to}.csv`,
      rowCount: rows.length,
      csv: toCsv(
        [
          "id", "fecha", "vencimiento", "cliente", "obra", "tipo", "concepto", "estado", "descripcion",
          "subtotal", "tps_gst", "tvq_pst", "impuesto_total", "retencion", "retencion_liberada",
          "total_a_cobrar", "fecha_de_pago", "medio_de_cobro", "referencia_de_cobro",
        ],
        rows
      ),
    };
  }

  // ---- Los dos formatos que QuickBooks importa tal cual ----
  //
  // El CSV genérico de arriba lo mapea el contable a mano una vez. Estos dos
  // llevan las columnas con los nombres que QuickBooks espera, así que se
  // suben sin mapear nada. Son dos archivos y en este orden a propósito:
  // QuickBooks rechaza una factura de un cliente que no conoce, así que los
  // clientes van primero.

  if (kind === "quickbooks-customers") {
    const { data } = await db
      .from("clients")
      .select("name, email, phone, address")
      .eq("business_id", businessId)
      .order("name");

    const rows = ((data ?? []) as any[]).map((c) => [c.name, c.name, c.email ?? "", c.phone ?? "", c.address ?? ""]);

    return {
      filename: `quickbooks-clientes-${from}-${to}.csv`,
      rowCount: rows.length,
      // Los nombres son de QuickBooks y van en inglés a propósito: es lo que
      // lee su importador, no una persona.
      csv: toCsv(["Name", "Company", "Email", "Phone", "Billing Address"], rows),
    };
  }

  if (kind === "quickbooks-invoices") {
    const [{ data: negocio }, { data }] = await Promise.all([
      db.from("businesses").select("province").eq("id", businessId).maybeSingle(),
      db
        .from("invoices")
        .select(
          "number, created_at, due_date, description, subtotal, tax_amount, amount, status, type, clients(name), projects(name)"
        )
        .eq("business_id", businessId)
        .neq("status", "cancelado")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at"),
    ]);

    const codigo = CODIGO_DE_IMPUESTO[String((negocio as any)?.province ?? "QC").toUpperCase()] ?? "GST";

    const rows = ((data ?? []) as any[]).map((i) => {
      // El concepto que QuickBooks va a crear como producto o servicio. Su
      // importador exige uno, y meter aquí la descripción entera dejaría la
      // lista de servicios llena de frases distintas que no agrupan nada.
      const concepto = i.projects?.name ? "Travaux de construction" : "Services";
      const descripcion = [i.description, i.projects?.name].filter(Boolean).join(" — ") || concepto;
      return [
        i.number ?? "",
        i.clients?.name ?? "",
        day(i.created_at),
        day(i.due_date),
        concepto,
        descripcion,
        1,
        // El importe antes de impuestos: el impuesto lo vuelve a calcular
        // QuickBooks desde el código. Mandar el total daría impuesto sobre
        // impuesto.
        money(i.subtotal),
        money(i.subtotal),
        codigo,
      ];
    });

    return {
      filename: `quickbooks-facturas-${from}-${to}.csv`,
      rowCount: rows.length,
      csv: toCsv(
        [
          "*InvoiceNo",
          "*Customer",
          "*InvoiceDate",
          "*DueDate",
          "Item(Product/Service)",
          "ItemDescription",
          "ItemQuantity",
          "ItemRate",
          "*ItemAmount",
          "ItemTaxCode",
        ],
        rows
      ),
    };
  }

  // Las notas de crédito van en su propio archivo, no restadas de las
  // facturas. Un libro tiene que enseñar las dos cosas: lo que se facturó y lo
  // que se corrigió después. Restarlas por dentro haría cuadrar el total y
  // borraría la corrección, que es justo lo que no se puede borrar.
  if (kind === "credit-notes") {
    const { data } = await db
      .from("credit_notes")
      .select("id, number, created_at, reason, subtotal, tax_amount, tax_breakdown, amount, invoices(number, clients(name), projects(name))")
      .eq("business_id", businessId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at");

    const rows = ((data ?? []) as any[]).map((n) => [
      n.id,
      n.number ? `NC-${n.number}` : "",
      day(n.created_at),
      n.invoices?.number ? `FAC-${n.invoices.number}` : "",
      n.invoices?.clients?.name ?? "",
      n.invoices?.projects?.name ?? "",
      n.reason ?? "",
      // En negativo, que es lo que son: importe que deja de deberse. Un
      // contable que vea 500 en una columna llamada "importe" los suma.
      `-${money(n.subtotal)}`,
      `-${money(n.tax_breakdown?.gst)}`,
      `-${money(n.tax_breakdown?.pst)}`,
      `-${money(n.tax_amount)}`,
      `-${money(n.amount)}`,
    ]);

    return {
      filename: `notas-de-credito-${from}-${to}.csv`,
      rowCount: rows.length,
      csv: toCsv(
        [
          "id", "numero", "fecha", "corrige_factura", "cliente", "obra", "motivo",
          "subtotal", "tps_gst", "tvq_pst", "impuesto_total", "total",
        ],
        rows
      ),
    };
  }

  if (kind === "payments") {
    const { data } = await db
      .from("payments")
      .select("id, paid_at, amount, status, stripe_payment_id, invoices(id, description, clients(name), projects(name))")
      .eq("business_id", businessId)
      .gte("paid_at", fromIso)
      .lte("paid_at", toIso)
      .order("paid_at");

    const rows = ((data ?? []) as any[]).map((p) => [
      p.id,
      day(p.paid_at),
      p.invoices?.clients?.name ?? "",
      p.invoices?.projects?.name ?? "",
      p.invoices?.id ?? "",
      p.invoices?.description ?? "",
      money(p.amount),
      p.status,
      p.stripe_payment_id ?? "",
    ]);

    return {
      filename: `pagos-${from}-${to}.csv`,
      rowCount: rows.length,
      csv: toCsv(
        ["id", "fecha", "cliente", "obra", "factura_id", "descripcion", "importe", "estado", "referencia_stripe"],
        rows
      ),
    };
  }

  const { data } = await db
    .from("expenses")
    .select("id, date, category, description, amount, projects(name)")
    .eq("business_id", businessId)
    .gte("date", from)
    .lte("date", to)
    .order("date");

  const rows = ((data ?? []) as any[]).map((e) => [
    e.id,
    day(e.date),
    e.projects?.name ?? "",
    e.category,
    e.description ?? "",
    money(e.amount),
  ]);

  return {
    filename: `gastos-${from}-${to}.csv`,
    rowCount: rows.length,
    csv: toCsv(["id", "fecha", "obra", "categoria", "descripcion", "importe"], rows),
  };
}
