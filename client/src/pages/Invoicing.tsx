import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PaymentRequestPanel } from "@/components/PaymentRequestPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, invoiceStatusTone } from "@/components/StatusBadge";
import { Codigo } from "@/components/Codigo";
import { SelectorDeObra } from "@/components/SelectorDeObra";
import { useFiltroDeObra } from "@/lib/filtroDeObra";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Plus, Copy, Check, Download, Ban, Banknote, FileMinus, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useApi, apiFetch, downloadFile, readJson, serverMessage } from "@/lib/api";
import { previewTax, type TaxRate } from "@/lib/taxes";
import { NeedsFirst } from "@/components/NeedsFirst";
import { useTranslation } from "react-i18next";
import { AvisoDeFallo } from "@/components/AvisoDeFallo";

const INVOICE_TYPES = ["deposito", "parcial", "final"] as const;
const INVOICE_STATUSES = ["pendiente", "pagado", "vencido", "cancelado"] as const;

interface Invoice {
  id: string;
  projectId: string | null;
  /** El número correlativo con el que la factura existe fuera del software. */
  number: string | null;
  type: (typeof INVOICE_TYPES)[number];
  amount: number;
  subtotal: number;
  taxAmount: number;
  holdbackAmount: number;
  holdbackReleased: number;
  status: (typeof INVOICE_STATUSES)[number];
  dueDate: string | null;
  description: string | null;
  projectName: string | null;
  clientName: string | null;
  /** Cómo entró el dinero. `stripe` es la tarjeta; el resto lo apuntó el contratista. */
  paymentMethod: "stripe" | "efectivo" | "transferencia" | "cheque" | "otro" | null;
  paymentReference: string | null;
  /** Lo ya acreditado con notas de crédito. */
  creditedAmount: number;
  /** Si llegó a QuickBooks. `null` cuando el negocio no lo usa. */
  quickbooks: {
    status: "pendiente" | "enviado" | "fallo";
    error: string | null;
    /** Alguien la cambió en QuickBooks y ya no coincide con la nuestra. */
    diverged: boolean;
    remoteTotal: number | null;
    remoteDeleted: boolean;
  } | null;
}

/**
 * Si la factura llegó a QuickBooks, y qué hacer si no.
 *
 * Se manda sola al emitirse, así que lo único que hace falta en pantalla es
 * saber si llegó. Cuando falla, el motivo se enseña entero: casi siempre dice
 * qué falta —un código de impuesto, una cuenta de ingresos— y esconderlo
 * detrás de «no se pudo» no ayuda a nadie a arreglarlo.
 */
function EstadoQuickBooks({ invoice, onRetried }: { invoice: Invoice; onRetried: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!invoice.quickbooks) return null;

  if (invoice.quickbooks.status === "enviado") {
    const qb = invoice.quickbooks;
    // Difiere: se enseñan los dos números y ya está. No se pisa lo nuestro
    // con lo suyo — la factura la emitimos aquí y es la que el cliente tiene
    // en la mano; quién se equivocó lo sabe el contratista, no el programa.
    if (qb.diverged) {
      return (
        <p className="text-xs text-status-warning-fg mt-1">
          {qb.remoteDeleted
            ? t("quickbooks.rowDeletedThere")
            : t("quickbooks.rowDiffers", {
                here: formatCurrency(invoice.amount),
                there: formatCurrency(qb.remoteTotal ?? 0),
              })}
        </p>
      );
    }
    return <p className="text-xs text-status-success-fg mt-1">{t("quickbooks.rowSent")}</p>;
  }

  const reintentar = async () => {
    setBusy(true);
    setError(null);
    const res = await apiFetch(`/api/quickbooks/retry/invoice/${invoice.id}`, { method: "POST" });
    const body = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (res.ok) onRetried();
    else setError(body?.error ?? t("common.genericError"));
  };

  return (
    <div className="mt-1 space-y-1">
      <p className="text-xs text-status-warning-fg">{t("quickbooks.rowNotSent")}</p>
      {(error ?? invoice.quickbooks.error) && (
        <p className="text-[11px] text-muted-foreground break-words max-w-xs">{error ?? invoice.quickbooks.error}</p>
      )}
      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs gap-1" onClick={reintentar} disabled={busy}>
        {busy ? <Spinner className="size-3" /> : <RefreshCw size={11} />} {t("quickbooks.rowRetry")}
      </Button>
    </div>
  );
}

/**
 * Emitir una nota de crédito sobre una factura.
 *
 * Una factura emitida no se toca: se corrige con esto, y las dos se quedan en
 * los libros. Sin importe se acredita lo que quede, que es el caso normal
 * —anularla entera— y evita teclear un total en el documento que existe
 * justamente para arreglar un error de tecleo.
 */
function NotaDeCreditoDialog({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [parcial, setParcial] = useState(false);
  const [importe, setImporte] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const libre = Math.round((invoice.amount - invoice.creditedAmount) * 100) / 100;

  const emitir = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          reason: motivo.trim(),
          amount: parcial && importe ? Number(importe) : undefined,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(body, t, t("common.genericError")));
      setOpen(false);
      setMotivo("");
      setParcial(false);
      setImporte("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <FileMinus size={13} strokeWidth={1.75} /> {t("creditNotes.issue")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("creditNotes.issueTitle", { number: invoice.number ?? "" })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("creditNotes.issueHint")}</p>
          <div className="space-y-1.5">
            <Label htmlFor="nc-motivo">{t("creditNotes.reason")}</Label>
            <Input
              id="nc-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={t("creditNotes.reasonPlaceholder")}
            />
            {/* Va impreso en el documento: es lo que va a leer quien revise
                los libros dentro de dos años. */}
            <p className="text-xs text-muted-foreground">{t("creditNotes.reasonNote")}</p>
          </div>

          <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={parcial} onChange={(e) => setParcial(e.target.checked)} />
            <span>
              {t("creditNotes.partial")}
              <span className="block text-xs text-muted-foreground">
                {t("creditNotes.fullBy", { amount: formatCurrency(libre) })}
              </span>
            </span>
          </label>

          {parcial && (
            <div className="space-y-1.5">
              <Label htmlFor="nc-importe">{t("creditNotes.amount")}</Label>
              <Input
                id="nc-importe"
                type="number"
                min={0}
                max={libre}
                step="0.01"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={emitir} disabled={busy || !motivo.trim() || (parcial && !importe)}>
            {busy ? <Spinner className="size-4" /> : t("creditNotes.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lo que se puede hacer con una factura.
 *
 * Uno solo para las dos formas de verla —la ficha del móvil y la fila del
 * escritorio—. Estaban duplicados y era cuestión de tiempo que alguien añadiera
 * un botón en un sitio y no en el otro.
 */
function AccionesDeFactura({
  invoice,
  onDone,
  pdfBusyId,
  linkBusyId,
  copiedId,
  onDownload,
  onCancel,
  onCopyLink,
}: {
  invoice: Invoice;
  onDone: () => void;
  pdfBusyId: string | null;
  linkBusyId: string | null;
  copiedId: string | null;
  onDownload: (id: string) => void;
  onCancel: (id: string) => void;
  onCopyLink: (id: string) => void;
}) {
  const { t } = useTranslation();
  const viva = invoice.status !== "pagado" && invoice.status !== "cancelado";

  return (
    <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 min-h-11 lg:min-h-0"
        onClick={() => onDownload(invoice.id)}
        disabled={pdfBusyId === invoice.id}
      >
        {pdfBusyId === invoice.id ? <Spinner className="size-3.5" /> : <Download size={13} strokeWidth={1.75} />}
        {t("invoicing.downloadPdf")}
      </Button>

      {viva && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 min-h-11 lg:min-h-0"
          onClick={() => onCopyLink(invoice.id)}
          disabled={linkBusyId === invoice.id}
        >
          {linkBusyId === invoice.id ? (
            <Spinner className="size-3.5" />
          ) : copiedId === invoice.id ? (
            <Check size={13} />
          ) : (
            <Copy size={13} />
          )}
          {copiedId === invoice.id ? t("invoicing.copied") : t("invoicing.copyPaymentLink")}
        </Button>
      )}

      {viva && <CobroManualDialog invoice={invoice} onDone={onDone} />}

      {/* La nota de crédito sí sale sobre una factura pagada: es justo el caso
          en que anularla ya no es una opción. */}
      {invoice.status !== "cancelado" && invoice.creditedAmount < invoice.amount && (
        <NotaDeCreditoDialog invoice={invoice} onDone={onDone} />
      )}

      {viva && (
        <button
          aria-label={t("invoicing.cancel")}
          title={t("invoicing.cancel")}
          className="p-1.5 min-h-11 lg:min-h-0 rounded-md text-muted-foreground hover:text-status-error-fg hover:bg-secondary transition-colors"
          onClick={() => onCancel(invoice.id)}
        >
          <Ban size={14} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

/** Los medios que se pueden apuntar a mano. La tarjeta la escribe Stripe, no el panel. */
const MEDIOS_A_MANO = ["transferencia", "efectivo", "cheque", "otro"] as const;

/**
 * Apuntar una factura que se cobró fuera del software.
 *
 * En construcción en Quebec la mayor parte se cobra por transferencia Interac
 * o con un cheque en la obra. Hasta ahora nada de eso podía llegar a "pagada":
 * la única forma era que el cliente metiera la tarjeta en su portal, así que
 * las facturas cobradas de verdad se quedaban pendientes, los totales de
 * arriba mentían, y la obra no se cerraba nunca.
 */
function CobroManualDialog({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [medio, setMedio] = useState<(typeof MEDIOS_A_MANO)[number]>("transferencia");
  const [referencia, setReferencia] = useState("");
  // La fecha del recibo, no la de hoy: el efectivo se apunta días después.
  const [dia, setDia] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/invoices/${invoice.id}/register-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: medio, reference: referencia.trim() || undefined, paidAt: dia }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(body, t, t("common.genericError")));
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Banknote size={13} strokeWidth={1.75} /> {t("invoicing.registerPayment")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("invoicing.registerPaymentTitle", { amount: formatCurrency(invoice.amount) })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("invoicing.registerPaymentHint")}</p>
          <div className="space-y-1.5">
            <Label>{t("invoicing.paymentMethod")}</Label>
            <Select value={medio} onValueChange={(v) => setMedio(v as (typeof MEDIOS_A_MANO)[number])}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MEDIOS_A_MANO.map((m) => (
                  <SelectItem key={m} value={m}>{t(`invoicing.method.${m}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cobro-dia">{t("invoicing.paidOn")}</Label>
            <Input id="cobro-dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cobro-ref">{t("invoicing.paymentReference")} ({t("common.optional")})</Label>
            <Input
              id="cobro-ref"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder={t("invoicing.paymentReferencePlaceholder")}
            />
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={guardar} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : t("invoicing.confirmPayment")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ClientOption {
  id: string;
  name: string;
}

function NewInvoiceDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState<"deposito" | "parcial" | "final">("deposito");
  const [subtotal, setSubtotal] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: clients } = useApi<ClientOption[]>(open ? "/api/clients" : null);
  const { data: rates } = useApi<TaxRate[]>(open ? "/api/canada-tax-rates" : null);
  const { data: company } = useApi<{ province: string }>(open ? "/api/settings/company" : null);

  const rate = rates?.find((r) => r.province === company?.province);
  const subtotalNum = Number(subtotal) || 0;
  // Se usa el mismo cálculo que el presupuesto y que el servidor. Antes aquí
  // se sumaban las dos tasas y se aplicaba de golpe (5 % + 9,975 % = 14,975 %),
  // y el servidor redondea cada impuesto por su cuenta: el total que se veía
  // al crear la factura podía no ser el de la factura, por un céntimo.
  const impuestos = previewTax(subtotalNum, rate ?? null);
  const total = impuestos.total;

  const reset = () => {
    setClientId("");
    setType("deposito");
    setSubtotal("");
    setDescription("");
    setError(null);
  };

  const create = async () => {
    if (!clientId || subtotalNum <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, type, subtotal: subtotalNum, description: description || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(serverMessage(body, t, t("invoicing.createError")));
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("invoicing.createError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 w-full sm:w-auto">
          <Plus size={16} /> {t("invoicing.newInvoice")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("invoicing.newInvoice")}</DialogTitle>
        </DialogHeader>
        {(clients ?? []).length === 0 ? (
          // Una factura se le cobra a alguien.
          <NeedsFirst
            message={t("common.needsClientFirst")}
            href="/crm"
            cta={t("common.goCreateClient")}
            onNavigate={() => setOpen(false)}
          />
        ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("common.client")}</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder={t("invoicing.selectClient")} /></SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.type")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVOICE_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>{t(`invoicing.typeLong.${v}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("invoicing.amountBeforeTax")}</Label>
            <Input type="number" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.description")} ({t("common.optional")})</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("invoicing.descriptionPlaceholder")} />
          </div>
          {subtotalNum > 0 && (
            <div className="rounded-lg bg-secondary/60 p-3 text-sm space-y-1">
              <div className="flex justify-between text-muted-foreground"><span>{t("common.subtotal")}</span><span>{formatCurrency(subtotalNum)}</span></div>
              {/* En Quebec son dos impuestos y se declaran por separado, así
                  que se enseñan por separado: una sola línea de "impuestos" no
                  le sirve a su contable ni cuadra con la factura en papel. */}
              {impuestos.parts.map((parte) => (
                <div key={parte.label} className="flex justify-between text-muted-foreground">
                  <span>{parte.label}</span><span>{formatCurrency(parte.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-medium text-foreground pt-1 border-t border-border"><span>{t("common.total")}</span><span>{formatCurrency(total)}</span></div>
            </div>
          )}
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={create} disabled={!clientId || subtotalNum <= 0 || saving}>
            {saving ? t("common.creating") : t("invoicing.createInvoice")}
          </Button>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Invoicing() {
  const { t, i18n } = useTranslation();
  const { data: invoices, loading, error, reload, detalle } = useApi<Invoice[]>("/api/invoices");
  // Chat charges are a pay button, so they only make sense once the business
  // can actually take a card.
  const { data: connect } = useApi<{ chargesEnabled: boolean }>("/api/stripe/connect/status");
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Las sumas de arriba cuentan lo mismo que enseña la tabla de abajo. Si la
  // tabla filtrara y los totales no, la pantalla se contradiría a sí misma.
  // Al abrir la pantalla se pide lo que haya cambiado allí. El freno de los
  // cinco minutos vive en el servidor: aquí no se sabe cuándo fue la última.
  // Si falla no se dice nada — quien viene a mirar sus facturas no tiene por
  // qué enterarse de que Intuit está caído.
  useEffect(() => {
    let vivo = true;
    apiFetch("/api/quickbooks/pull", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (vivo && body && (body.revisadas > 0 || body.cobradas?.length > 0)) reload();
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // Una vez al entrar, no en cada cambio de filtro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { filtrar } = useFiltroDeObra();
  const visibles = filtrar(invoices, (i) => i.projectId);

  // Lo acreditado ya no se debe ni se ha cobrado, así que sale de los dos
  // totales. Antes una factura acreditada a medias seguía sumando entera.
  const neto = (i: Invoice) => i.amount - i.creditedAmount;
  const totalPending = visibles.filter((i) => i.status === "pendiente" || i.status === "vencido").reduce((s, i) => s + neto(i), 0);
  const totalPaid = visibles.filter((i) => i.status === "pagado").reduce((s, i) => s + neto(i), 0);

  const downloadInvoice = async (invoiceId: string) => {
    setPdfBusyId(invoiceId);
    setLinkError(null);
    try {
      await downloadFile(
        `/api/invoices/${invoiceId}/pdf?download=1&lang=${i18n.language.slice(0, 2)}`,
        `${t("invoicing.invoiceFilePrefix")}-${invoiceId.slice(0, 8).toUpperCase()}.pdf`
      );
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setPdfBusyId(null);
    }
  };

  // Cancelling, not deleting: an invoice is an accounting record, and one
  // that was paid cannot be cancelled at all.
  const cancelInvoice = async (invoiceId: string) => {
    if (!window.confirm(t("invoicing.cancelConfirm"))) return;
    setLinkError(null);
    const res = await apiFetch(`/api/invoices/${invoiceId}/cancel`, { method: "PATCH" });
    if (res.ok) reload();
    else setLinkError(serverMessage(await res.json().catch(() => null), t, t("common.genericError")));
  };

  const copyLink = async (invoiceId: string) => {
    setLinkBusyId(invoiceId);
    setLinkError(null);
    try {
      const res = await apiFetch(`/api/invoices/${invoiceId}/checkout-link?lang=${i18n.language.slice(0, 2)}`, { method: "POST" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(body, t, t("invoicing.linkError")));
      await navigator.clipboard.writeText(body.url);
      setCopiedId(invoiceId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : t("invoicing.linkError"));
    } finally {
      setLinkBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={t("invoicing.title")}
        description={t("invoicing.description")}
        action={<NewInvoiceDialog onCreated={reload} />}
      />

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">{t("invoicing.tabInvoices")}</TabsTrigger>
          <TabsTrigger value="requests">{t("invoicing.tabRequests")}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <PaymentRequestPanel stripeReady={Boolean(connect?.chargesEnabled)} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-6">
      <SelectorDeObra />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{t("invoicing.collected")}</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{t("invoicing.pendingOverdue")}</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{formatCurrency(totalPending)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{t("invoicing.totalInvoices")}</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{visibles.length}</p>
        </Card>
      </div>

      {linkError && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">{linkError}</div>
      )}

      <Card className="p-4 sm:p-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Spinner className="size-4" /> {t("common.loading")}
          </div>
        )}
        {error && (
          <AvisoDeFallo
            mensaje={t("common.loadError", { message: error })}
            detalle={detalle}
            onReintentar={reload}
          />
        )}

        {/* Por debajo de lg, una ficha por factura.
            La tabla mide 1255 px por los botones de cada fila, y en un iPhone
            de 390 se salían 900: "Marquer payée" quedaba fuera de la pantalla y
            había que arrastrar de lado para encontrarlo. Con guantes, de pie y
            con prisa, eso es un botón que no existe. */}
        {!loading && !error && (
          <div className="lg:hidden divide-y divide-border">
            {visibles.map((invoice) => (
              <div key={invoice.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Codigo code={invoice.number} />
                    <p className="text-foreground font-medium truncate mt-1">
                      {invoice.clientName ?? invoice.projectName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {invoice.description ?? "-"} · {t(`invoicing.type.${invoice.type}`)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-foreground font-semibold">{formatCurrency(invoice.amount)}</p>
                    <StatusBadge tone={invoiceStatusTone[invoice.status] ?? "info"}>
                      {t(`invoicing.status.${invoice.status}`)}
                    </StatusBadge>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5">
                  {invoice.holdbackAmount > 0 && (
                    <p>{t("invoicing.holdbackWithheld", { amount: formatCurrency(invoice.holdbackAmount) })}</p>
                  )}
                  {invoice.holdbackReleased > 0 && (
                    <p className="text-status-success-fg">
                      {t("invoicing.holdbackReleased", { amount: formatCurrency(invoice.holdbackReleased) })}
                    </p>
                  )}
                  {invoice.creditedAmount > 0 && (
                    <p className="text-status-warning-fg">
                      {t("creditNotes.credited", { amount: formatCurrency(invoice.creditedAmount) })}
                    </p>
                  )}
                  {invoice.status === "pagado" && invoice.paymentMethod && (
                    <p>
                      {t(`invoicing.method.${invoice.paymentMethod}`)}
                      {invoice.paymentReference && ` · ${invoice.paymentReference}`}
                    </p>
                  )}
                </div>

                <EstadoQuickBooks invoice={invoice} onRetried={reload} />

                <AccionesDeFactura
                  invoice={invoice}
                  onDone={reload}
                  pdfBusyId={pdfBusyId}
                  linkBusyId={linkBusyId}
                  copiedId={copiedId}
                  onDownload={downloadInvoice}
                  onCancel={cancelInvoice}
                  onCopyLink={copyLink}
                />
              </div>
            ))}
            {visibles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("invoicing.noInvoices")}</p>
            )}
          </div>
        )}

        {!loading && !error && (
          <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">{t("invoicing.number")}</th>
                <th className="text-left py-2 text-muted-foreground font-medium">{t("common.client")}</th>
                <th className="text-left py-2 text-muted-foreground font-medium">{t("common.description")}</th>
                <th className="text-left py-2 text-muted-foreground font-medium">{t("common.type")}</th>
                {/* El importe va a la derecha y el estado a la izquierda, así que
                    sin este hueco los dos rótulos se tocan y se leen como una
                    sola palabra: "MontoEstado". */}
                <th className="text-right py-2 pr-6 text-muted-foreground font-medium">{t("common.amount")}</th>
                <th className="text-left py-2 pl-2 text-muted-foreground font-medium">{t("common.status")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border last:border-0 hover:bg-secondary transition-colors">
                  {/* Primera columna: es por lo que el cliente pregunta al
                      llamar, y lo que el contable busca. */}
                  <td className="py-3"><Codigo code={invoice.number} /></td>
                  <td className="py-3 text-foreground font-medium">{invoice.clientName ?? invoice.projectName}</td>
                  <td className="py-3 text-muted-foreground">{invoice.description ?? "-"}</td>
                  <td className="py-3 text-muted-foreground">{t(`invoicing.type.${invoice.type}`)}</td>
                  <td className="py-3 pr-6 text-right text-foreground">
                    {formatCurrency(invoice.amount)}
                    {invoice.holdbackReleased > 0 && (
                      <p className="text-xs text-status-success-fg mt-0.5">
                        {t("invoicing.holdbackReleased", { amount: formatCurrency(invoice.holdbackReleased) })}
                      </p>
                    )}
                    {invoice.holdbackAmount > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {t("invoicing.holdbackWithheld", { amount: formatCurrency(invoice.holdbackAmount) })}
                      </span>
                    )}
                    {invoice.creditedAmount > 0 && (
                      <p className="text-xs text-status-warning-fg mt-0.5">
                        {t("creditNotes.credited", { amount: formatCurrency(invoice.creditedAmount) })}
                      </p>
                    )}
                    <EstadoQuickBooks invoice={invoice} onRetried={reload} />
                  </td>
                  <td className="py-3 pl-2">
                    <StatusBadge tone={invoiceStatusTone[invoice.status] ?? "info"}>{t(`invoicing.status.${invoice.status}`)}</StatusBadge>
                    {/* Cómo entró el dinero. Sin esto, una transferencia y una
                        tarjeta se leen exactamente igual, y es lo primero que
                        pregunta el contable. */}
                    {invoice.status === "pagado" && invoice.paymentMethod && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t(`invoicing.method.${invoice.paymentMethod}`)}
                        {invoice.paymentReference && ` · ${invoice.paymentReference}`}
                      </p>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <AccionesDeFactura
                      invoice={invoice}
                      onDone={reload}
                      pdfBusyId={pdfBusyId}
                      linkBusyId={linkBusyId}
                      copiedId={copiedId}
                      onDownload={downloadInvoice}
                      onCancel={cancelInvoice}
                      onCopyLink={copyLink}
                    />
                  </td>
                </tr>
              ))}
              {invoices?.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">{t("invoicing.noInvoices")}</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Send size={12} /> {t("invoicing.stripeNote")}
      </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
