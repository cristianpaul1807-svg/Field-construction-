import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, invoiceStatusTone } from "@/components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Plus, Copy, Check, Download, Ban } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useApi, apiFetch, downloadFile } from "@/lib/api";
import { useTranslation } from "react-i18next";

const INVOICE_TYPES = ["deposito", "parcial", "final"] as const;
const INVOICE_STATUSES = ["pendiente", "pagado", "vencido", "cancelado"] as const;

interface Invoice {
  id: string;
  type: (typeof INVOICE_TYPES)[number];
  amount: number;
  subtotal: number;
  taxAmount: number;
  holdbackAmount: number;
  status: (typeof INVOICE_STATUSES)[number];
  dueDate: string | null;
  description: string | null;
  projectName: string | null;
  clientName: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

interface TaxRate {
  province: string;
  isHst: boolean;
  gstRate: number;
  pstRate: number;
  hstRate: number;
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
  const taxRate = rate ? (rate.isHst ? rate.hstRate : rate.gstRate + rate.pstRate) : 0;
  const taxAmount = subtotalNum * taxRate;
  const total = subtotalNum + taxAmount;

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
      if (!res.ok) throw new Error(body?.error || t("invoicing.createError"));
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
              <div className="flex justify-between text-muted-foreground">
                <span>{t("invoicing.tax", { rate: (taxRate * 100).toFixed(3) })}</span><span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between font-medium text-foreground pt-1 border-t border-border"><span>{t("common.total")}</span><span>{formatCurrency(total)}</span></div>
            </div>
          )}
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={create} disabled={!clientId || subtotalNum <= 0 || saving}>
            {saving ? t("common.creating") : t("invoicing.createInvoice")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Invoicing() {
  const { t, i18n } = useTranslation();
  const { data: invoices, loading, error, reload } = useApi<Invoice[]>("/api/invoices");
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const totalPending = (invoices ?? []).filter((i) => i.status === "pendiente" || i.status === "vencido").reduce((s, i) => s + i.amount, 0);
  const totalPaid = (invoices ?? []).filter((i) => i.status === "pagado").reduce((s, i) => s + i.amount, 0);

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
    else setLinkError((await res.json().catch(() => null))?.error || t("common.genericError"));
  };

  const copyLink = async (invoiceId: string) => {
    setLinkBusyId(invoiceId);
    setLinkError(null);
    try {
      const res = await apiFetch(`/api/invoices/${invoiceId}/checkout-link`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || t("invoicing.linkError"));
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
          <p className="text-2xl font-semibold text-foreground mt-2">{invoices?.length ?? 0}</p>
        </Card>
      </div>

      {linkError && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">{linkError}</div>
      )}

      <Card className="p-6 overflow-x-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Spinner className="size-4" /> {t("common.loading")}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
            {t("common.loadError", { message: error })}
          </div>
        )}

        {!loading && !error && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">{t("common.client")}</th>
                <th className="text-left py-2 text-muted-foreground font-medium">{t("common.description")}</th>
                <th className="text-left py-2 text-muted-foreground font-medium">{t("common.type")}</th>
                <th className="text-right py-2 text-muted-foreground font-medium">{t("common.amount")}</th>
                <th className="text-left py-2 text-muted-foreground font-medium">{t("common.status")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {invoices?.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border last:border-0 hover:bg-secondary transition-colors">
                  <td className="py-3 text-foreground font-medium">{invoice.clientName ?? invoice.projectName}</td>
                  <td className="py-3 text-muted-foreground">{invoice.description ?? "-"}</td>
                  <td className="py-3 text-muted-foreground">{t(`invoicing.type.${invoice.type}`)}</td>
                  <td className="py-3 text-right text-foreground">
                    {formatCurrency(invoice.amount)}
                    {invoice.holdbackAmount > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {t("invoicing.holdbackWithheld", { amount: formatCurrency(invoice.holdbackAmount) })}
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    <StatusBadge tone={invoiceStatusTone[invoice.status] ?? "info"}>{t(`invoicing.status.${invoice.status}`)}</StatusBadge>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => downloadInvoice(invoice.id)}
                      disabled={pdfBusyId === invoice.id}
                    >
                      {pdfBusyId === invoice.id ? <Spinner className="size-3.5" /> : <Download size={13} strokeWidth={1.75} />}
                      {t("invoicing.downloadPdf")}
                    </Button>
                    {invoice.status !== "pagado" && invoice.status !== "cancelado" && (
                      <button
                        aria-label={t("invoicing.cancel")}
                        title={t("invoicing.cancel")}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-status-error-fg hover:bg-secondary transition-colors"
                        onClick={() => cancelInvoice(invoice.id)}
                      >
                        <Ban size={14} strokeWidth={1.75} />
                      </button>
                    )}
                    {invoice.status !== "pagado" && invoice.status !== "cancelado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => copyLink(invoice.id)}
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
                    </div>
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
        )}
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Send size={12} /> {t("invoicing.stripeNote")}
      </p>
    </div>
  );
}
