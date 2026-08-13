import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useApi, apiFetch, readJson } from "@/lib/api";
import { useTranslation } from "react-i18next";

/**
 * Asking a customer for money in the chat they already use.
 *
 * Two decisions are the whole point of the form. **What kind of money** —
 * agreed work or extra — because without it the reports cannot tell a project
 * running over budget from one that simply grew, which are opposite problems.
 * And **when** — a contractor decides what to charge while thinking about the
 * job, not on the day it is due.
 *
 * The feature needs Stripe: a request the customer cannot pay is just a
 * message. When Stripe is not connected the form is not shown as a broken
 * button — it says so and points at what does work, which is issuing the
 * invoice normally and sending its PDF.
 */

interface PaymentRequest {
  id: string;
  kind: "proyecto" | "extra";
  basis: "porcentaje" | "monto";
  percent: number | null;
  amount: number | null;
  description: string | null;
  status: "programado" | "enviado" | "pagado" | "cancelado";
  sendAt: string | null;
  sentAt: string | null;
  clientName: string | null;
  projectName: string | null;
  invoiceAmount: number | null;
  invoiceStatus: string | null;
}

interface Option {
  id: string;
  name: string;
  clientId?: string | null;
}

const statusTone: Record<PaymentRequest["status"], "neutral" | "info" | "success" | "warning"> = {
  programado: "warning",
  enviado: "info",
  pagado: "success",
  cancelado: "neutral",
};

export function PaymentRequestPanel({ stripeReady }: { stripeReady: boolean }) {
  const { t } = useTranslation();
  const [reloadToken, setReloadToken] = useState(0);
  const { data: requests, loading } = useApi<PaymentRequest[]>(`/api/payment-requests?_r=${reloadToken}`);
  const { data: clients } = useApi<Option[]>("/api/clients");
  const { data: projects } = useApi<Option[]>("/api/projects");

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [kind, setKind] = useState<"proyecto" | "extra">("proyecto");
  const [basis, setBasis] = useState<"porcentaje" | "monto">("monto");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [sendAt, setSendAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => setReloadToken((n) => n + 1);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          projectId: projectId || null,
          kind,
          basis,
          percent: basis === "porcentaje" ? Number(value) : undefined,
          amount: basis === "monto" ? Number(value) : undefined,
          description: description.trim() || null,
          // A date with no time means the start of that day, which is when a
          // contractor means "on the 15th".
          sendAt: sendAt ? new Date(`${sendAt}T09:00:00`).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const body = await readJson<{ error?: string; code?: string }>(res);
        throw new Error(
          body?.code === "percent_needs_project" ? t("paymentRequests.percentNeedsProject") : body?.error || t("common.genericError")
        );
      }
      setValue("");
      setDescription("");
      setSendAt("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async (id: string) => {
    setBusyId(id);
    try {
      await apiFetch(`/api/payment-requests/${id}/send`, { method: "POST" });
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (id: string) => {
    setBusyId(id);
    try {
      await apiFetch(`/api/payment-requests/${id}`, { method: "DELETE" });
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (!stripeReady) {
    return (
      <Card className="p-6 space-y-2">
        <p className="text-sm font-medium text-foreground">{t("paymentRequests.needsStripeTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("paymentRequests.needsStripeBody")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("paymentRequests.newTitle")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("paymentRequests.newNote")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("common.client")}</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder={t("invoicing.selectClient")} />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("common.project")}</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder={t("workOrders.selectProject")} />
              </SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("paymentRequests.kind")}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proyecto">{t("paymentRequests.kinds.proyecto")}</SelectItem>
                <SelectItem value="extra">{t("paymentRequests.kinds.extra")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("paymentRequests.basis")}</Label>
            <Select value={basis} onValueChange={(v) => setBasis(v as typeof basis)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monto">{t("paymentRequests.bases.monto")}</SelectItem>
                <SelectItem value="porcentaje">{t("paymentRequests.bases.porcentaje")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              {basis === "porcentaje" ? t("paymentRequests.percentLabel") : t("paymentRequests.amountLabel")}
            </Label>
            <Input
              type="number"
              min={0}
              step={basis === "porcentaje" ? 1 : 0.01}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("paymentRequests.description")}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("paymentRequests.descriptionPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("paymentRequests.sendOn")}</Label>
            <Input type="date" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("paymentRequests.sendOnHint")}</p>
          </div>
        </div>

        <Button className="self-start gap-1.5" onClick={create} disabled={saving || !clientId || !value}>
          {saving ? <Spinner className="size-4" /> : <Send size={14} />}
          {sendAt ? t("paymentRequests.schedule") : t("paymentRequests.sendNow")}
        </Button>
        {error && <p className="text-sm text-status-error-fg">{error}</p>}
      </Card>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}

      {!loading && (requests ?? []).length === 0 && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{t("paymentRequests.empty")}</p>
        </Card>
      )}

      {(requests ?? []).map((request) => (
        <Card key={request.id} className="p-4 flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{request.clientName}</span>
              <StatusBadge tone={statusTone[request.status]}>{t(`paymentRequests.status.${request.status}`)}</StatusBadge>
              <StatusBadge tone={request.kind === "extra" ? "warning" : "neutral"}>
                {t(`paymentRequests.kinds.${request.kind}`)}
              </StatusBadge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {request.projectName ? `${request.projectName} · ` : ""}
              {request.basis === "porcentaje"
                ? t("paymentRequests.percentOf", { percent: request.percent })
                : formatCurrency(request.amount ?? 0)}
              {request.description ? ` · ${request.description}` : ""}
              {request.sendAt && request.status === "programado"
                ? ` · ${t("paymentRequests.scheduledFor", { date: new Date(request.sendAt).toLocaleDateString() })}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {request.invoiceAmount !== null && (
              <span className="text-sm font-semibold text-foreground">{formatCurrency(request.invoiceAmount)}</span>
            )}
            {request.status === "programado" && (
              <Button size="sm" variant="outline" onClick={() => sendNow(request.id)} disabled={busyId === request.id}>
                {busyId === request.id ? <Spinner className="size-4" /> : <Send size={13} />}
                {t("paymentRequests.sendNow")}
              </Button>
            )}
            {(request.status === "programado" || request.status === "enviado") && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-status-error-fg"
                onClick={() => cancel(request.id)}
                disabled={busyId === request.id}
                aria-label={t("common.cancel")}
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
