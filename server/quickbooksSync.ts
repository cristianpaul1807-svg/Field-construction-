import { llamar, QuickBooksSinConectar } from "./quickbooks";
import type { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Lo que se manda a QuickBooks, y cuándo.
 *
 * Se manda **solo**, al emitirse. Un contratista no tiene que acordarse de
 * pulsar nada para que su contabilidad esté al día; si tuviera que acordarse,
 * la mitad de las veces no se acordaría y la otra mitad no sabría cuáles
 * faltan.
 *
 * Pero automático no quiere decir mudo. Cada envío deja su rastro en
 * `quickbooks_links` —enviado, o fallido y por qué— y la pantalla lo enseña
 * con un botón de reintentar. Una contabilidad que se desincroniza en silencio
 * es peor que un botón: el desajuste sale a la luz meses después, delante del
 * contable, y para entonces nadie se acuerda de qué pasó ese martes.
 *
 * Nada de lo que hay aquí puede tumbar una emisión. La factura se emite en
 * nuestro sistema pase lo que pase con QuickBooks; que su contabilidad esté
 * caída no puede impedirle facturar.
 */

type Admin = ReturnType<typeof getSupabaseAdmin>;
type Tipo = "customer" | "invoice" | "credit_note";

interface Enlace {
  qbo_id: string | null;
  sync_token: string | null;
  status: string;
}

async function leerEnlace(admin: Admin, businessId: string, kind: Tipo, localId: string): Promise<Enlace | null> {
  const { data } = await admin
    .from("quickbooks_links")
    .select("qbo_id, sync_token, status")
    .eq("business_id", businessId)
    .eq("kind", kind)
    .eq("local_id", localId)
    .maybeSingle();
  return (data as Enlace) ?? null;
}

async function anotar(
  admin: Admin,
  businessId: string,
  kind: Tipo,
  localId: string,
  campos: Partial<{ qbo_id: string | null; sync_token: string | null; status: string; error: string | null }>
) {
  await admin.from("quickbooks_links").upsert(
    {
      business_id: businessId,
      kind,
      local_id: localId,
      last_attempt_at: new Date().toISOString(),
      ...(campos.status === "enviado" ? { synced_at: new Date().toISOString() } : {}),
      ...campos,
    },
    { onConflict: "business_id,kind,local_id" }
  );
}

/**
 * El mensaje de un fallo, recortado y sin nada que no deba guardarse.
 *
 * Los errores de Intuit traen el cuerpo entero de la respuesta. Guardarlo
 * completo llena la tabla de ruido y puede arrastrar datos que no pintan nada
 * en una columna que se enseña en pantalla.
 */
function motivo(err: unknown): string {
  const texto = err instanceof Error ? err.message : String(err);
  return texto.replace(/\s+/g, " ").slice(0, 300);
}

/** El código de impuesto de la provincia, tal y como lo nombra QuickBooks Canadá. */
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
};

/**
 * El identificador del código de impuesto dentro de esa empresa.
 *
 * QuickBooks no acepta un nombre: quiere el id del código que esa empresa
 * concreta tiene dado de alta, y cada empresa tiene los suyos. Se busca por
 * nombre y se devuelve el id.
 */
async function idDelImpuesto(admin: Admin, businessId: string, provincia: string): Promise<string | null> {
  const nombre = CODIGO_DE_IMPUESTO[provincia.toUpperCase()];
  if (!nombre) return null;
  try {
    const consulta = `select Id, Name from TaxCode where Name = '${nombre.replace(/'/g, "''")}'`;
    const res = await llamar<{ QueryResponse?: { TaxCode?: { Id: string }[] } }>(
      admin,
      businessId,
      `query?query=${encodeURIComponent(consulta)}&minorversion=70`
    );
    return res.QueryResponse?.TaxCode?.[0]?.Id ?? null;
  } catch {
    // Sin código, la línea se manda sin impuesto explícito y QuickBooks aplica
    // el de la empresa. Peor que acertar, mejor que no mandar nada.
    return null;
  }
}

/** El servicio genérico bajo el que entran los trabajos. Se crea la primera vez. */
async function idDelServicio(admin: Admin, businessId: string): Promise<string | null> {
  try {
    const consulta = "select Id from Item where Name = 'Travaux de construction'";
    const res = await llamar<{ QueryResponse?: { Item?: { Id: string }[] } }>(
      admin,
      businessId,
      `query?query=${encodeURIComponent(consulta)}&minorversion=70`
    );
    const existente = res.QueryResponse?.Item?.[0]?.Id;
    if (existente) return existente;

    // La cuenta de ingresos hace falta para crear un servicio. Se coge la
    // primera de ingresos que tenga la empresa en vez de inventarse una: el
    // plan contable es suyo, no nuestro.
    const cuentas = await llamar<{ QueryResponse?: { Account?: { Id: string }[] } }>(
      admin,
      businessId,
      `query?query=${encodeURIComponent("select Id from Account where AccountType = 'Income' maxresults 1")}&minorversion=70`
    );
    const cuenta = cuentas.QueryResponse?.Account?.[0]?.Id;
    if (!cuenta) return null;

    const creado = await llamar<{ Item?: { Id: string } }>(admin, businessId, "item?minorversion=70", {
      method: "POST",
      body: { Name: "Travaux de construction", Type: "Service", IncomeAccountRef: { value: cuenta } },
    });
    return creado.Item?.Id ?? null;
  } catch {
    return null;
  }
}

/**
 * El cliente en QuickBooks, creándolo si no está.
 *
 * Va antes que cualquier factura suya: QuickBooks rechaza una factura de un
 * cliente que no conoce, y el error que devuelve no dice que falte el cliente.
 */
export async function enviarCliente(admin: Admin, businessId: string, clientId: string): Promise<string | null> {
  const enlace = await leerEnlace(admin, businessId, "customer", clientId);
  if (enlace?.qbo_id) return enlace.qbo_id;

  const { data: cliente } = await admin
    .from("clients")
    .select("name, email, phone, address")
    .eq("business_id", businessId)
    .eq("id", clientId)
    .maybeSingle();
  if (!cliente) return null;

  try {
    // Por nombre primero: si el contratista ya lo tenía en QuickBooks de
    // antes, crearlo otra vez le dejaría dos fichas del mismo cliente.
    const consulta = `select Id from Customer where DisplayName = '${String(cliente.name).replace(/'/g, "''")}'`;
    const existente = await llamar<{ QueryResponse?: { Customer?: { Id: string }[] } }>(
      admin,
      businessId,
      `query?query=${encodeURIComponent(consulta)}&minorversion=70`
    );
    let id = existente.QueryResponse?.Customer?.[0]?.Id ?? null;

    if (!id) {
      const creado = await llamar<{ Customer?: { Id: string } }>(admin, businessId, "customer?minorversion=70", {
        method: "POST",
        body: {
          DisplayName: cliente.name,
          ...(cliente.email ? { PrimaryEmailAddr: { Address: cliente.email } } : {}),
          ...(cliente.phone ? { PrimaryPhone: { FreeFormNumber: cliente.phone } } : {}),
          ...(cliente.address ? { BillAddr: { Line1: cliente.address } } : {}),
        },
      });
      id = creado.Customer?.Id ?? null;
    }

    if (!id) throw new Error("QuickBooks no devolvió un id de cliente");
    await anotar(admin, businessId, "customer", clientId, { qbo_id: id, status: "enviado", error: null });
    return id;
  } catch (err) {
    await anotar(admin, businessId, "customer", clientId, { status: "fallo", error: motivo(err) });
    throw err;
  }
}

/**
 * Una factura en QuickBooks.
 *
 * El impuesto no se manda calculado: se manda el código y lo calcula
 * QuickBooks. Mandar nuestro total daría impuesto sobre impuesto, y además los
 * libros tienen que cuadrar con **sus** reglas, que son las que el contable va
 * a mirar.
 */
export async function enviarFactura(admin: Admin, businessId: string, invoiceId: string): Promise<void> {
  const enlace = await leerEnlace(admin, businessId, "invoice", invoiceId);
  if (enlace?.qbo_id) return;

  const { data: factura } = await admin
    .from("invoices")
    .select("id, number, client_id, created_at, due_date, description, subtotal, status, projects(name)")
    .eq("business_id", businessId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (!factura) return;
  // Una factura anulada no se manda: allí no existe, y crearla para anularla
  // acto seguido deja dos apuntes donde no debería haber ninguno.
  if (factura.status === "cancelado") return;

  try {
    const clienteQbo = factura.client_id ? await enviarCliente(admin, businessId, factura.client_id) : null;
    if (!clienteQbo) throw new Error("la factura no tiene cliente en QuickBooks");

    const { data: negocio } = await admin
      .from("businesses")
      .select("province")
      .eq("id", businessId)
      .maybeSingle();

    const [servicio, impuesto] = await Promise.all([
      idDelServicio(admin, businessId),
      idDelImpuesto(admin, businessId, String(negocio?.province ?? "QC")),
    ]);

    const proyecto = (factura.projects as unknown as { name: string } | null)?.name ?? null;
    const descripcion = [factura.description, proyecto].filter(Boolean).join(" — ") || "Travaux de construction";

    const creada = await llamar<{ Invoice?: { Id: string; SyncToken: string } }>(
      admin,
      businessId,
      "invoice?minorversion=70",
      {
        method: "POST",
        body: {
          CustomerRef: { value: clienteQbo },
          // Nuestro número, para que las dos contabilidades hablen del mismo
          // papel. Sin esto, casar una factura de aquí con una de allí es
          // comparar importes a ojo.
          DocNumber: factura.number ?? undefined,
          TxnDate: String(factura.created_at).slice(0, 10),
          ...(factura.due_date ? { DueDate: String(factura.due_date).slice(0, 10) } : {}),
          Line: [
            {
              DetailType: "SalesItemLineDetail",
              Amount: Number(factura.subtotal),
              Description: descripcion,
              SalesItemLineDetail: {
                ...(servicio ? { ItemRef: { value: servicio } } : {}),
                Qty: 1,
                UnitPrice: Number(factura.subtotal),
                ...(impuesto ? { TaxCodeRef: { value: impuesto } } : {}),
              },
            },
          ],
          ...(impuesto ? { TxnTaxDetail: { TxnTaxCodeRef: { value: impuesto } } } : {}),
        },
      }
    );

    const id = creada.Invoice?.Id;
    if (!id) throw new Error("QuickBooks no devolvió un id de factura");
    await anotar(admin, businessId, "invoice", invoiceId, {
      qbo_id: id,
      sync_token: creada.Invoice?.SyncToken ?? null,
      status: "enviado",
      error: null,
    });
  } catch (err) {
    await anotar(admin, businessId, "invoice", invoiceId, { status: "fallo", error: motivo(err) });
    throw err;
  }
}

/** Una nota de crédito en QuickBooks, contra el mismo cliente que la factura. */
export async function enviarNotaDeCredito(admin: Admin, businessId: string, creditNoteId: string): Promise<void> {
  const enlace = await leerEnlace(admin, businessId, "credit_note", creditNoteId);
  if (enlace?.qbo_id) return;

  const { data: nota } = await admin
    .from("credit_notes")
    .select("id, number, reason, subtotal, created_at, invoices(client_id)")
    .eq("business_id", businessId)
    .eq("id", creditNoteId)
    .maybeSingle();
  if (!nota) return;

  try {
    const clienteId = (nota.invoices as unknown as { client_id: string } | null)?.client_id ?? null;
    const clienteQbo = clienteId ? await enviarCliente(admin, businessId, clienteId) : null;
    if (!clienteQbo) throw new Error("la nota no tiene cliente en QuickBooks");

    const { data: negocio } = await admin.from("businesses").select("province").eq("id", businessId).maybeSingle();
    const [servicio, impuesto] = await Promise.all([
      idDelServicio(admin, businessId),
      idDelImpuesto(admin, businessId, String(negocio?.province ?? "QC")),
    ]);

    const creada = await llamar<{ CreditMemo?: { Id: string; SyncToken: string } }>(
      admin,
      businessId,
      "creditmemo?minorversion=70",
      {
        method: "POST",
        body: {
          CustomerRef: { value: clienteQbo },
          DocNumber: nota.number ? `NC-${nota.number}` : undefined,
          TxnDate: String(nota.created_at).slice(0, 10),
          PrivateNote: nota.reason,
          Line: [
            {
              DetailType: "SalesItemLineDetail",
              Amount: Number(nota.subtotal),
              Description: nota.reason,
              SalesItemLineDetail: {
                ...(servicio ? { ItemRef: { value: servicio } } : {}),
                Qty: 1,
                UnitPrice: Number(nota.subtotal),
                ...(impuesto ? { TaxCodeRef: { value: impuesto } } : {}),
              },
            },
          ],
          ...(impuesto ? { TxnTaxDetail: { TxnTaxCodeRef: { value: impuesto } } } : {}),
        },
      }
    );

    const id = creada.CreditMemo?.Id;
    if (!id) throw new Error("QuickBooks no devolvió un id de nota de crédito");
    await anotar(admin, businessId, "credit_note", creditNoteId, {
      qbo_id: id,
      sync_token: creada.CreditMemo?.SyncToken ?? null,
      status: "enviado",
      error: null,
    });
  } catch (err) {
    await anotar(admin, businessId, "credit_note", creditNoteId, { status: "fallo", error: motivo(err) });
    throw err;
  }
}

/**
 * Manda algo en segundo plano, sin que nada de lo que pase allí pueda tumbar
 * lo de aquí.
 *
 * Quien emite una factura no puede quedarse esperando a QuickBooks, y menos
 * ver un error suyo: la factura ya está emitida y es válida. El fallo queda
 * anotado y la pantalla lo enseña con un botón de reintentar.
 */
export function enviarEnSegundoPlano(promesa: Promise<unknown>, que: string): void {
  promesa.catch((err) => {
    // Si el negocio no ha conectado QuickBooks no hay nada que registrar: no
    // es un fallo, es que no usa la integración.
    if (err instanceof QuickBooksSinConectar) return;
    console.error(`quickbooks: no se pudo mandar ${que}`, err);
  });
}
