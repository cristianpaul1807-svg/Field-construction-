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
type Tipo = "customer" | "invoice" | "credit_note" | "payment" | "estimate" | "expense" | "stripe_fee";

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
  return texto.replace(/\s+/g, " ").slice(0, 900);
}

/**
 * Qué palabra tiene que aparecer en el nombre del código, por provincia.
 *
 * No el nombre entero: **el nombre exacto no se puede adivinar**. Se intentó
 * con "GST/QST QC" y la empresa de pruebas no tenía ninguno así, de modo que
 * la línea salió sin impuesto y QuickBooks Canadá la rechazó entera:
 *
 *   Business Validation Error: Make sure all your transactions
 *   have a GST/HST rate before you save.  (code 6000)
 *
 * Cada empresa nombra los suyos como quiere y QuickBooks los crea distinto
 * según la provincia y el año. Así que se piden todos y se elige por lo que
 * contienen.
 */
const PISTA_DE_IMPUESTO: Record<string, RegExp> = {
  QC: /qst|tvq/i,
  ON: /hst/i,
  NS: /hst/i,
  NB: /hst/i,
  NL: /hst/i,
  PE: /hst/i,
  BC: /pst/i,
  MB: /pst|rst/i,
  SK: /pst/i,
  AB: /gst/i,
  NT: /gst/i,
  NU: /gst/i,
  YT: /gst/i,
};

/** Lo que nunca es el impuesto normal de una factura de obra. */
const NO_ES_IMPUESTO = /exempt|zero|out of scope|hors|esent|no tax/i;

/**
 * El código de impuesto de esa empresa, elegido entre los que tiene.
 *
 * Se piden todos los activos y se queda con el que lleva el impuesto
 * provincial en el nombre; si no hay ninguno, con el primero que cobre algo.
 * Quedarse sin código no es una opción: QuickBooks Canadá rechaza la factura
 * entera, y el mensaje que devuelve no dice que falte un código, dice que
 * falta una tasa.
 */
async function idDelImpuesto(admin: Admin, businessId: string, provincia: string): Promise<string | null> {
  try {
    const res = await llamar<{
      QueryResponse?: {
        TaxCode?: {
          Id: string;
          Name: string;
          Active?: boolean;
          Taxable?: boolean;
          SalesTaxRateList?: { TaxRateDetail?: unknown[] };
        }[];
      };
    }>(
      admin,
      businessId,
      `query?query=${encodeURIComponent("select * from TaxCode maxresults 200")}&minorversion=70`
    );

    // Con tasa de venta, no sólo activo. Un código de compra está activo y es
    // gravable igual, y mandarlo en una factura le pide a QuickBooks que
    // calcule con algo que no tiene tasa de venta: entonces no dice que el
    // código esté mal, dice que no consiguió calcular el impuesto.
    const candidatos = (res.QueryResponse?.TaxCode ?? []).filter(
      (c) =>
        c.Active !== false &&
        c.Taxable !== false &&
        (c.SalesTaxRateList?.TaxRateDetail?.length ?? 0) > 0 &&
        !NO_ES_IMPUESTO.test(c.Name ?? "")
    );
    if (candidatos.length === 0) return null;

    const pista = PISTA_DE_IMPUESTO[provincia.toUpperCase()];
    const dePorvincia = pista ? candidatos.find((c) => pista.test(c.Name ?? "")) : undefined;
    // Y si no hay de la provincia, el primero que cobre algo: una factura con
    // el impuesto de otra provincia se corrige en dos clics; una factura que
    // no llegó no se corrige, porque nadie sabe que falta.
    return (dePorvincia ?? candidatos[0]).Id;
  } catch {
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

    // Mandarla sin código es mandarla para que la rechacen. Mejor no gastar la
    // llamada y dejar escrito qué falta, que es lo que el contratista puede
    // arreglar en su QuickBooks.
    if (!impuesto) {
      throw new Error(
        "tu QuickBooks no tiene ningún código de impuesto que se pueda usar. Créalo en Taxes → Sales tax y vuelve a intentarlo."
      );
    }

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
          // Sin `TxnTaxDetail`. Una empresa canadiense lleva el cálculo
          // automático de impuestos, y mandarle a la vez el código de la línea
          // y el del documento le pide dos cosas que tiene que cuadrar solo;
          // cuando no puede, contesta que no consiguió calcular el impuesto.
          // El código de la línea es el que manda.
          GlobalTaxCalculation: "TaxExcluded",
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

    if (!impuesto) {
      throw new Error(
        "tu QuickBooks no tiene ningún código de impuesto que se pueda usar. Créalo en Taxes → Sales tax y vuelve a intentarlo."
      );
    }

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
          GlobalTaxCalculation: "TaxExcluded",
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

/**
 * Qué tiene esa empresa en QuickBooks, para poder mirarlo en vez de adivinarlo.
 *
 * Un envío que falla dice qué salió mal pero no qué había. Dos rondas de
 * prueba y error se fueron en no saber cómo se llamaban los códigos de
 * impuesto de una empresa concreta; esto contesta esa pregunta de una vez.
 *
 * No devuelve nada que no sea suyo ni nada sensible: nombres y tasas de sus
 * propios códigos, que es lo mismo que ve en su pantalla de impuestos.
 */
export async function diagnostico(admin: Admin, businessId: string) {
  const pedir = async <T>(consulta: string): Promise<T | { error: string }> => {
    try {
      return await llamar<T>(admin, businessId, `query?query=${encodeURIComponent(consulta)}&minorversion=70`);
    } catch (err) {
      return { error: motivo(err) };
    }
  };

  const [codigos, servicios, cuentas] = await Promise.all([
    pedir<{ QueryResponse?: { TaxCode?: any[] } }>("select * from TaxCode maxresults 200"),
    pedir<{ QueryResponse?: { Item?: any[] } }>("select Id, Name, Type from Item maxresults 50"),
    pedir<{ QueryResponse?: { Account?: any[] } }>(
      "select Id, Name, AccountType from Account where AccountType = 'Income' maxresults 20"
    ),
  ]);

  const lista = (codigos as any)?.QueryResponse?.TaxCode ?? [];
  return {
    taxCodes: lista.map((c: any) => ({
      id: c.Id,
      name: c.Name,
      active: c.Active,
      taxable: c.Taxable,
      // Lo que decide si sirve para una factura: un código de compra está
      // activo y es gravable igual, pero no tiene tasa de venta.
      salesRates: (c.SalesTaxRateList?.TaxRateDetail ?? []).length,
      purchaseRates: (c.PurchaseTaxRateList?.TaxRateDetail ?? []).length,
    })),
    items: (servicios as any)?.QueryResponse?.Item ?? [],
    incomeAccounts: (cuentas as any)?.QueryResponse?.Account ?? [],
    errores: [codigos, servicios, cuentas].filter((r: any) => r?.error).map((r: any) => r.error),
  };
}

/**
 * Traer lo que ha cambiado en QuickBooks.
 *
 * QuickBooks tiene una llamada que devuelve lo que se ha tocado desde una
 * fecha, así que no hay que recorrer todo cada vez.
 *
 * **Lo nuestro no se sobrescribe con lo suyo, y es a propósito.** La factura
 * la emitimos aquí y es la que el cliente tiene en la mano; si alguien cambia
 * el importe allí, el equivocado puede ser cualquiera de los dos, y decidirlo
 * en silencio es la peor opción posible. Se guarda lo que dice QuickBooks, se
 * marca que difieren, y lo resuelve el contratista mirando los dos números.
 *
 * Lo único que sí se toma de allí es el **cobro**. Si QuickBooks dice que la
 * factura está saldada, eso es información que aquí no existía: alguien cobró
 * y lo apuntó en la contabilidad. Eso no contradice nada nuestro, lo completa.
 */
export async function traerCambios(
  admin: Admin,
  businessId: string,
  opciones?: { forzar?: boolean }
): Promise<{ revisadas: number; divergentes: number; cobradas: string[]; omitido?: true }> {
  const { data: conexion } = await admin
    .from("quickbooks_connections")
    .select("last_sync_at")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!conexion) throw new QuickBooksSinConectar();

  const desde = conexion.last_sync_at ? new Date(conexion.last_sync_at) : null;

  // Cinco minutos de descanso. Esto se dispara al abrir la pantalla de
  // facturas, y sin freno cada recarga sería una llamada a Intuit.
  if (!opciones?.forzar && desde && Date.now() - desde.getTime() < 5 * 60_000) {
    return { revisadas: 0, divergentes: 0, cobradas: [], omitido: true };
  }

  // La primera vez, treinta días. QuickBooks no acepta un rango cualquiera y
  // tampoco tiene sentido revisar el año entero para arrancar.
  const cuando = desde ?? new Date(Date.now() - 30 * 86_400_000);

  const res = await llamar<{
    CDCResponse?: { QueryResponse?: { Invoice?: any[] }[] }[];
  }>(admin, businessId, `cdc?entities=Invoice&changedSince=${cuando.toISOString()}&minorversion=70`);

  const remotas: any[] = [];
  for (const bloque of res.CDCResponse ?? []) {
    for (const q of bloque.QueryResponse ?? []) {
      for (const f of q.Invoice ?? []) remotas.push(f);
    }
  }

  // Sólo interesan las que salieron de aquí. Una factura que el contratista
  // creó directamente en QuickBooks es suya y no tenemos nada que decir.
  const { data: enlaces } = await admin
    .from("quickbooks_links")
    .select("local_id, qbo_id")
    .eq("business_id", businessId)
    .eq("kind", "invoice")
    .eq("status", "enviado");
  const porQbo = new Map((enlaces ?? []).map((e: any) => [String(e.qbo_id), e.local_id]));

  const cobradas: string[] = [];
  let divergentes = 0;
  let revisadas = 0;

  for (const remota of remotas) {
    const localId = porQbo.get(String(remota.Id));
    if (!localId) continue;
    revisadas += 1;

    const { data: nuestra } = await admin
      .from("invoices")
      .select("id, number, amount, status")
      .eq("business_id", businessId)
      .eq("id", localId)
      .maybeSingle();
    if (!nuestra) continue;

    const importeRemoto = Number(remota.TotalAmt ?? 0);
    const saldo = Number(remota.Balance ?? importeRemoto);
    // `status: "Deleted"` es cómo CDC dice que allí ya no existe.
    const borrada = String(remota.status ?? "").toLowerCase() === "deleted";

    // Un céntimo de diferencia es redondeo, no una corrección.
    const difiere = borrada || Math.abs(importeRemoto - Number(nuestra.amount)) > 0.01;
    if (difiere) divergentes += 1;

    await admin
      .from("quickbooks_links")
      .update({
        remote: {
          total: importeRemoto,
          balance: saldo,
          docNumber: remota.DocNumber ?? null,
          txnDate: remota.TxnDate ?? null,
          deleted: borrada,
        },
        diverged: difiere,
        checked_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .eq("kind", "invoice")
      .eq("local_id", localId);

    // El cobro sí se toma. Que esté saldada allí es algo que aquí no sabíamos.
    if (!borrada && saldo === 0 && importeRemoto > 0 && nuestra.status !== "pagado" && nuestra.status !== "cancelado") {
      cobradas.push(nuestra.id);
    }
  }

  await admin
    .from("quickbooks_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("business_id", businessId);

  return { revisadas, divergentes, cobradas };
}

/**
 * Un cobro en QuickBooks, colgado de su factura.
 *
 * Sin esto la integración estaba a medias de la peor forma: las facturas
 * llegaban y los cobros no, así que en su contabilidad **todo aparecía
 * impagado** aunque Stripe hubiera cobrado días antes. Un contable mirando eso
 * ve una empresa que factura y no cobra.
 *
 * Se cuelga de la factura con `LinkedTxn`, que es lo que hace que QuickBooks
 * salde esa factura concreta. Un pago suelto por el mismo importe deja las dos
 * cosas abiertas: un cobro sin asignar y una factura sin pagar.
 */
export async function enviarPago(admin: Admin, businessId: string, paymentId: string): Promise<void> {
  const enlace = await leerEnlace(admin, businessId, "payment", paymentId);
  if (enlace?.qbo_id) return;

  const { data: pago } = await admin
    .from("payments")
    .select("id, invoice_id, amount, paid_at, method, reference, invoices(client_id)")
    .eq("business_id", businessId)
    .eq("id", paymentId)
    .maybeSingle();
  if (!pago) return;

  try {
    // La factura tiene que estar allí antes que su cobro. Si aún no llegó se
    // manda ahora: el cobro llega detrás y no se pierde ninguno de los dos.
    if (pago.invoice_id) await enviarFactura(admin, businessId, pago.invoice_id);

    const facturaEnlace = pago.invoice_id ? await leerEnlace(admin, businessId, "invoice", pago.invoice_id) : null;
    if (!facturaEnlace?.qbo_id) throw new Error("la factura de este cobro todavía no está en QuickBooks");

    const clienteId = (pago.invoices as unknown as { client_id: string } | null)?.client_id ?? null;
    const clienteQbo = clienteId ? await enviarCliente(admin, businessId, clienteId) : null;
    if (!clienteQbo) throw new Error("el cobro no tiene cliente en QuickBooks");

    // A la cuenta bancaria, no a la de fondos sin depositar que QuickBooks usa
    // por defecto. Con tarjeta, la comisión de Stripe se apunta como una
    // compra pagada desde el banco, y si el cobro no ha entrado ahí el banco se
    // queda en negativo por el importe de la comisión: dos apuntes correctos
    // que juntos enseñan una cuenta que no existe.
    //
    // Si ese plan contable no tiene cuenta bancaria, se deja que QuickBooks
    // elija. Es su plan, no el nuestro.
    const cuentaDelDeposito = pago.method === "stripe" ? await idDeCuenta(admin, businessId, "Bank") : null;

    const creado = await llamar<{ Payment?: { Id: string; SyncToken: string } }>(
      admin,
      businessId,
      "payment?minorversion=70",
      {
        method: "POST",
        body: {
          CustomerRef: { value: clienteQbo },
          TotalAmt: Number(pago.amount),
          ...(cuentaDelDeposito ? { DepositToAccountRef: { value: cuentaDelDeposito } } : {}),
          TxnDate: String(pago.paid_at ?? new Date().toISOString()).slice(0, 10),
          // Con qué se cobró, para que el contable pueda casarlo con el banco.
          PrivateNote: [pago.method, pago.reference].filter(Boolean).join(" · ") || undefined,
          Line: [
            {
              Amount: Number(pago.amount),
              LinkedTxn: [{ TxnId: facturaEnlace.qbo_id, TxnType: "Invoice" }],
            },
          ],
        },
      }
    );

    const id = creado.Payment?.Id;
    if (!id) throw new Error("QuickBooks no devolvió un id de cobro");
    await anotar(admin, businessId, "payment", paymentId, {
      qbo_id: id,
      sync_token: creado.Payment?.SyncToken ?? null,
      status: "enviado",
      error: null,
    });
  } catch (err) {
    await anotar(admin, businessId, "payment", paymentId, { status: "fallo", error: motivo(err) });
    throw err;
  }
}

/**
 * Un presupuesto en QuickBooks.
 *
 * Se manda cuando sale hacia el cliente, no antes: un borrador que el
 * contratista está afinando no es un documento, y llenarle la contabilidad de
 * borradores es ensuciarla.
 */
export async function enviarPresupuesto(admin: Admin, businessId: string, estimateId: string): Promise<void> {
  const enlace = await leerEnlace(admin, businessId, "estimate", estimateId);
  if (enlace?.qbo_id) return;

  const { data: presupuesto } = await admin
    .from("estimates")
    .select("id, number, client_id, created_at, description, status")
    .eq("business_id", businessId)
    .eq("id", estimateId)
    .maybeSingle();
  if (!presupuesto || !presupuesto.client_id) return;

  try {
    const [clienteQbo, negocio, lineas] = await Promise.all([
      enviarCliente(admin, businessId, presupuesto.client_id),
      admin.from("businesses").select("province").eq("id", businessId).maybeSingle(),
      admin.from("estimate_lines").select("quantity, unit_cost").eq("estimate_id", estimateId),
    ]);
    if (!clienteQbo) throw new Error("el presupuesto no tiene cliente en QuickBooks");

    // El total sin impuestos, que es lo que se manda: el impuesto lo calcula
    // QuickBooks igual que en una factura.
    const subtotal =
      Math.round(
        (lineas.data ?? []).reduce((suma, l: any) => suma + Number(l.quantity) * Number(l.unit_cost), 0) * 100
      ) / 100;
    if (subtotal <= 0) return;

    const [servicio, impuesto] = await Promise.all([
      idDelServicio(admin, businessId),
      idDelImpuesto(admin, businessId, String((negocio.data as any)?.province ?? "QC")),
    ]);
    if (!impuesto) {
      throw new Error(
        "tu QuickBooks no tiene ningún código de impuesto que se pueda usar. Créalo en Taxes → Sales tax y vuelve a intentarlo."
      );
    }

    const creado = await llamar<{ Estimate?: { Id: string; SyncToken: string } }>(
      admin,
      businessId,
      "estimate?minorversion=70",
      {
        method: "POST",
        body: {
          CustomerRef: { value: clienteQbo },
          DocNumber: presupuesto.number ? `EST-${presupuesto.number}` : undefined,
          TxnDate: String(presupuesto.created_at).slice(0, 10),
          Line: [
            {
              DetailType: "SalesItemLineDetail",
              Amount: subtotal,
              Description: presupuesto.description ?? "Travaux de construction",
              SalesItemLineDetail: {
                ...(servicio ? { ItemRef: { value: servicio } } : {}),
                Qty: 1,
                UnitPrice: subtotal,
                TaxCodeRef: { value: impuesto },
              },
            },
          ],
          GlobalTaxCalculation: "TaxExcluded",
        },
      }
    );

    const id = creado.Estimate?.Id;
    if (!id) throw new Error("QuickBooks no devolvió un id de presupuesto");
    await anotar(admin, businessId, "estimate", estimateId, {
      qbo_id: id,
      sync_token: creado.Estimate?.SyncToken ?? null,
      status: "enviado",
      error: null,
    });
  } catch (err) {
    await anotar(admin, businessId, "estimate", estimateId, { status: "fallo", error: motivo(err) });
    throw err;
  }
}

/** Una cuenta del plan contable de esa empresa, de un tipo concreto. */
async function idDeCuenta(admin: Admin, businessId: string, tipo: string): Promise<string | null> {
  try {
    const res = await llamar<{ QueryResponse?: { Account?: { Id: string }[] } }>(
      admin,
      businessId,
      `query?query=${encodeURIComponent(`select Id from Account where AccountType = '${tipo}' maxresults 1`)}&minorversion=70`
    );
    return res.QueryResponse?.Account?.[0]?.Id ?? null;
  } catch {
    return null;
  }
}

/**
 * Un gasto de obra en QuickBooks.
 *
 * Sin los gastos, su contabilidad enseña lo que ingresa y nada de lo que le
 * cuesta: una empresa que factura cien mil y no gasta nada. El beneficio que
 * declararía sería el ingreso entero.
 *
 * QuickBooks pide dos cuentas de su plan contable —de dónde salió el dinero y
 * a qué concepto va— y las dos son suyas, no nuestras. Se cogen las que tenga
 * en vez de inventárselas: un plan contable es una decisión de su contable.
 */
export async function enviarGasto(admin: Admin, businessId: string, expenseId: string): Promise<void> {
  const enlace = await leerEnlace(admin, businessId, "expense", expenseId);
  if (enlace?.qbo_id) return;

  const { data: gasto } = await admin
    .from("expenses")
    .select("id, date, category, description, amount, projects(name)")
    .eq("business_id", businessId)
    .eq("id", expenseId)
    .maybeSingle();
  if (!gasto || Number(gasto.amount) <= 0) return;

  try {
    const [cuentaOrigen, cuentaGasto] = await Promise.all([
      idDeCuenta(admin, businessId, "Bank"),
      idDeCuenta(admin, businessId, "Expense"),
    ]);
    if (!cuentaOrigen || !cuentaGasto) {
      throw new Error(
        "tu QuickBooks necesita una cuenta bancaria y una de gastos para registrar compras. Créalas en su plan contable y vuelve a intentarlo."
      );
    }

    const obra = (gasto.projects as unknown as { name: string } | null)?.name ?? null;
    const creado = await llamar<{ Purchase?: { Id: string; SyncToken: string } }>(
      admin,
      businessId,
      "purchase?minorversion=70",
      {
        method: "POST",
        body: {
          AccountRef: { value: cuentaOrigen },
          PaymentType: "Cash",
          TxnDate: String(gasto.date).slice(0, 10),
          Line: [
            {
              DetailType: "AccountBasedExpenseLineDetail",
              Amount: Number(gasto.amount),
              // La categoría nuestra y la obra, para que el gasto se pueda leer
              // sin abrir nuestro sistema.
              Description: [gasto.description, gasto.category, obra].filter(Boolean).join(" · "),
              AccountBasedExpenseLineDetail: { AccountRef: { value: cuentaGasto } },
            },
          ],
        },
      }
    );

    const id = creado.Purchase?.Id;
    if (!id) throw new Error("QuickBooks no devolvió un id de gasto");
    await anotar(admin, businessId, "expense", expenseId, {
      qbo_id: id,
      sync_token: creado.Purchase?.SyncToken ?? null,
      status: "enviado",
      error: null,
    });
  } catch (err) {
    await anotar(admin, businessId, "expense", expenseId, { status: "fallo", error: motivo(err) });
    throw err;
  }
}

/**
 * Qué hacer con un fallo, en una palabra que la pantalla sabe traducir.
 *
 * El mensaje que devuelve Intuit está escrito para quien programa: habla de
 * validaciones, de tokens y de objetos obsoletos. Un contratista leyendo
 * «Business Validation Error: Make sure all your transactions have a GST/HST
 * rate» no sabe si el problema es suyo, nuestro, o de nadie.
 *
 * Esto lo traduce a la acción que resuelve cada caso. El texto original no se
 * tira —sigue guardado y se puede desplegar— porque el día que aparezca uno
 * que no conocemos, es lo único que permite averiguar qué pasó.
 */
export function comoArreglarlo(error: string | null): string {
  const texto = error ?? "";
  if (/tax code|GST\/HST rate|calculating tax|código de impuesto/i.test(texto)) return "tax";
  if (/cuenta bancaria|AccountType|Account.*required|cuenta de gastos/i.test(texto)) return "accounts";
  if (/Duplicate Document Number|DocNumber/i.test(texto)) return "duplicate";
  if (/AuthenticationFailed|Token|401|invalid_grant|unauthorized/i.test(texto)) return "reconnect";
  if (/Stale Object|SyncToken/i.test(texto)) return "stale";
  if (/todavía no está en QuickBooks|no tiene cliente/i.test(texto)) return "order";
  return "generic";
}

/** Lo que no ha llegado a QuickBooks, con qué es cada cosa y qué hacer. */
export async function loQueFalta(admin: Admin, businessId: string) {
  const { data } = await admin
    .from("quickbooks_links")
    .select("kind, local_id, status, error, last_attempt_at")
    .eq("business_id", businessId)
    .neq("status", "enviado")
    .order("last_attempt_at", { ascending: false })
    .limit(100);

  const filas = data ?? [];
  if (filas.length === 0) return [];

  // Los rótulos salen de cada tabla, para que la lista diga "Factura
  // 2026-0003 · Nestor" y no un identificador que no le dice nada a nadie.
  const porTipo = (kind: string) => filas.filter((f: any) => f.kind === kind).map((f: any) => f.local_id);
  const [facturas, notas, clientes, presupuestos, gastos, comisiones] = await Promise.all([
    admin.from("invoices").select("id, number, amount, clients(name)").in("id", porTipo("invoice").length ? porTipo("invoice") : ["-"]),
    admin.from("credit_notes").select("id, number, amount").in("id", porTipo("credit_note").length ? porTipo("credit_note") : ["-"]),
    admin.from("clients").select("id, name").in("id", porTipo("customer").length ? porTipo("customer") : ["-"]),
    admin.from("estimates").select("id, number").in("id", porTipo("estimate").length ? porTipo("estimate") : ["-"]),
    admin.from("expenses").select("id, description, amount").in("id", porTipo("expense").length ? porTipo("expense") : ["-"]),
    admin
      .from("payments")
      .select("id, stripe_fee, invoices(number)")
      .in("id", porTipo("stripe_fee").length ? porTipo("stripe_fee") : ["-"]),
  ]);

  const buscar = (kind: string, id: string): string => {
    if (kind === "invoice") {
      const f = (facturas.data ?? []).find((x: any) => x.id === id) as any;
      return f ? `${f.number ?? ""} · ${f.clients?.name ?? ""}`.trim() : "";
    }
    if (kind === "credit_note") {
      const n = (notas.data ?? []).find((x: any) => x.id === id) as any;
      return n ? `NC-${n.number ?? ""}` : "";
    }
    if (kind === "customer") return ((clientes.data ?? []).find((x: any) => x.id === id) as any)?.name ?? "";
    if (kind === "estimate") {
      const e = (presupuestos.data ?? []).find((x: any) => x.id === id) as any;
      return e ? `EST-${e.number ?? ""}` : "";
    }
    if (kind === "expense") return ((gastos.data ?? []).find((x: any) => x.id === id) as any)?.description ?? "";
    if (kind === "stripe_fee") {
      const c = (comisiones.data ?? []).find((x: any) => x.id === id) as any;
      return c ? [c.invoices?.number, c.stripe_fee ? `${c.stripe_fee}` : null].filter(Boolean).join(" · ") : "";
    }
    // Un cobro no tiene nombre propio: se reconoce por su factura, y esa ya
    // sale en la lista si también falló.
    return "";
  };

  return filas.map((f: any) => ({
    kind: f.kind,
    id: f.local_id,
    label: buscar(f.kind, f.local_id),
    status: f.status,
    error: f.error,
    // La acción que lo resuelve, no el mensaje de Intuit.
    fix: comoArreglarlo(f.error),
    lastAttemptAt: f.last_attempt_at,
  }));
}

/**
 * Una cuenta suya por tipo y, si se puede, por subtipo.
 *
 * La comisión de la pasarela tiene su sitio en cualquier plan contable —«Bank
 * Charges», «Frais bancaires»— y meterla en la primera cuenta de gastos que
 * aparezca la mezcla con los materiales. Se busca el subtipo primero y se cae
 * al tipo sólo si ese plan no lo tiene.
 */
async function idDeCuentaPorSubtipo(
  admin: Admin,
  businessId: string,
  tipo: string,
  subtipos: string[]
): Promise<string | null> {
  for (const subtipo of subtipos) {
    try {
      const res = await llamar<{ QueryResponse?: { Account?: { Id: string }[] } }>(
        admin,
        businessId,
        `query?query=${encodeURIComponent(
          `select Id from Account where AccountType = '${tipo}' and AccountSubType = '${subtipo}' maxresults 1`
        )}&minorversion=70`
      );
      const id = res.QueryResponse?.Account?.[0]?.Id;
      if (id) return id;
    } catch {
      // Un subtipo que ese plan no conoce no es un error: se prueba el
      // siguiente.
    }
  }
  return idDeCuenta(admin, businessId, tipo);
}

/**
 * El código de impuesto que sirve en una **compra**.
 *
 * No es el mismo que el de las ventas. Un código de venta no lleva tasa de
 * compra, y usarlo aquí hace que QuickBooks no sepa calcular nada. Importa
 * acertar: la TPS y la TVQ que Stripe cobra sobre su comisión son un crédito
 * que el contratista recupera, y si entran como parte del gasto se pierden.
 */
async function idDelImpuestoDeCompra(admin: Admin, businessId: string, provincia: string): Promise<string | null> {
  try {
    const res = await llamar<{
      QueryResponse?: {
        TaxCode?: {
          Id: string;
          Name: string;
          Active?: boolean;
          Taxable?: boolean;
          PurchaseTaxRateList?: { TaxRateDetail?: unknown[] };
        }[];
      };
    }>(
      admin,
      businessId,
      `query?query=${encodeURIComponent("select * from TaxCode maxresults 200")}&minorversion=70`
    );

    const candidatos = (res.QueryResponse?.TaxCode ?? []).filter(
      (c) =>
        c.Active !== false &&
        c.Taxable !== false &&
        (c.PurchaseTaxRateList?.TaxRateDetail?.length ?? 0) > 0 &&
        !NO_ES_IMPUESTO.test(c.Name ?? "")
    );
    if (candidatos.length === 0) return null;

    const pista = PISTA_DE_IMPUESTO[provincia.toUpperCase()];
    const suyo = pista ? candidatos.find((c) => pista.test(c.Name ?? "")) : undefined;
    return (suyo ?? candidatos[0]).Id;
  } catch {
    return null;
  }
}

/**
 * La comisión de Stripe, como el gasto que es.
 *
 * Un cobro de 5 748,75 $ no deja 5 748,75 $ en el banco. Sin este apunte, en
 * QuickBooks la factura queda cobrada entera y el depósito que llega es menor,
 * y el contable tiene una diferencia que no puede explicar — que es justo el
 * trabajo que esta integración existe para ahorrarle.
 *
 * Va como compra pagada desde la cuenta bancaria, porque eso es literalmente lo
 * que pasó: Stripe se cobró de ese dinero antes de depositarlo.
 *
 * Y con el impuesto sacado aparte. En Canadá la comisión lleva TPS y TVQ
 * encima; se manda **con impuesto incluido** para que el total cuadre con
 * Stripe al centavo y sea QuickBooks quien lo desglose con sus propias tasas,
 * que son las que mira el contable.
 */
export async function enviarComisionDeStripe(admin: Admin, businessId: string, paymentId: string): Promise<void> {
  const enlace = await leerEnlace(admin, businessId, "stripe_fee", paymentId);
  if (enlace?.qbo_id) return;

  const { data: pago } = await admin
    .from("payments")
    .select("id, paid_at, stripe_fee, stripe_fee_tax, stripe_balance_txn_id, invoices(number)")
    .eq("business_id", businessId)
    .eq("id", paymentId)
    .maybeSingle();
  // Sin comisión apuntada todavía no hay nada que mandar, y no es un fallo: el
  // dato aparece cuando Stripe asienta la transacción.
  if (!pago || !pago.stripe_fee || Number(pago.stripe_fee) <= 0) return;

  try {
    const { data: empresa } = await admin
      .from("businesses")
      .select("province")
      .eq("id", businessId)
      .maybeSingle();

    const [cuentaBanco, cuentaComision, impuesto] = await Promise.all([
      idDeCuenta(admin, businessId, "Bank"),
      idDeCuentaPorSubtipo(admin, businessId, "Expense", ["BankCharges", "OtherMiscellaneousServiceCost"]),
      Number(pago.stripe_fee_tax) > 0
        ? idDelImpuestoDeCompra(admin, businessId, empresa?.province ?? "QC")
        : Promise.resolve(null),
    ]);
    if (!cuentaBanco || !cuentaComision) {
      throw new Error(
        "tu QuickBooks necesita una cuenta bancaria y una de gastos para registrar compras. Créalas en su plan contable y vuelve a intentarlo."
      );
    }

    const factura = (pago.invoices as unknown as { number: string } | null)?.number ?? null;
    const conImpuesto = Boolean(impuesto);
    // Si su plan no tiene código de compra no se deja de mandar el gasto: se
    // manda entero y se dice en el concepto cuánto era impuesto, para que su
    // contable lo pueda reclasificar. Perder la comisión entera por no poder
    // separar el impuesto sería cambiar un problema pequeño por uno grande.
    const aviso =
      !conImpuesto && Number(pago.stripe_fee_tax) > 0
        ? `incl. taxes ${Number(pago.stripe_fee_tax).toFixed(2)}`
        : null;

    const creado = await llamar<{ Purchase?: { Id: string; SyncToken: string } }>(
      admin,
      businessId,
      "purchase?minorversion=70",
      {
        method: "POST",
        body: {
          AccountRef: { value: cuentaBanco },
          PaymentType: "Cash",
          TxnDate: String(pago.paid_at ?? new Date().toISOString()).slice(0, 10),
          GlobalTaxCalculation: conImpuesto ? "TaxInclusive" : "NotApplicable",
          // La transacción del libro mayor de Stripe, que es como se casa este
          // apunte con el depósito que llegó al banco.
          PrivateNote: pago.stripe_balance_txn_id ?? undefined,
          Line: [
            {
              DetailType: "AccountBasedExpenseLineDetail",
              Amount: Number(pago.stripe_fee),
              Description: ["Stripe", factura, aviso].filter(Boolean).join(" · "),
              AccountBasedExpenseLineDetail: {
                AccountRef: { value: cuentaComision },
                ...(conImpuesto ? { TaxCodeRef: { value: impuesto } } : {}),
              },
            },
          ],
        },
      }
    );

    const id = creado.Purchase?.Id;
    if (!id) throw new Error("QuickBooks no devolvió un id de gasto");
    await anotar(admin, businessId, "stripe_fee", paymentId, {
      qbo_id: id,
      sync_token: creado.Purchase?.SyncToken ?? null,
      status: "enviado",
      error: null,
    });
  } catch (err) {
    await anotar(admin, businessId, "stripe_fee", paymentId, { status: "fallo", error: motivo(err) });
    throw err;
  }
}
