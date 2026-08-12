import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { useApi, apiFetch, readJson } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface ConnectStatus {
  connected: boolean;
  status: "pending" | "active" | "restricted";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

interface TaxRate {
  province: string;
  label: string;
  isHst: boolean;
  gstRate: number;
  pstRate: number;
  hstRate: number;
}

interface CompanyData {
  province: string;
}

const statusTone: Record<ConnectStatus["status"], "success" | "warning" | "error"> = {
  active: "success",
  pending: "warning",
  restricted: "error",
};

export default function SettingsPayments() {
  const { t } = useTranslation();
  const [reloadToken, setReloadToken] = useState(0);
  const { data: connectStatus, loading } = useApi<ConnectStatus>(`/api/stripe/connect/status?_r=${reloadToken}`);
  const { data: rates } = useApi<TaxRate[]>("/api/canada-tax-rates");
  const { data: company } = useApi<CompanyData>(`/api/settings/company?_r=${reloadToken}`);
  const [connecting, setConnecting] = useState(false);
  const [savingProvince, setSavingProvince] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "completo") {
      apiFetch("/api/stripe/connect/refresh", { method: "POST" }).finally(() => setReloadToken((t) => t + 1));
    }
  }, []);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/stripe/connect/onboarding-link", { method: "POST" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body?.error || t("payments.connectError"));
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("payments.connectError"));
      setConnecting(false);
    }
  };

  const setProvince = async (province: string) => {
    setSavingProvince(true);
    try {
      await apiFetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ province }),
      });
      setReloadToken((t) => t + 1);
    } finally {
      setSavingProvince(false);
    }
  };

  const currentRate = rates?.find((r) => r.province === company?.province);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title={t("payments.title")} description={t("payments.description")} />

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CreditCard size={20} strokeWidth={1.75} className="text-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("payments.stripeAccount")}</h2>
            <p className="text-xs text-muted-foreground">{t("payments.stripeAccountNote")}</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" /> {t("common.loading")}
          </div>
        )}

        {!loading && connectStatus && (
          <div className="flex items-center justify-between flex-wrap gap-3 rounded-lg border border-border p-4">
            <div>
              <StatusBadge tone={connectStatus.connected ? statusTone[connectStatus.status] : "warning"}>
                {connectStatus.connected ? t(`payments.status.${connectStatus.status}`) : t("payments.notConnected")}
              </StatusBadge>
              {connectStatus.connected && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {connectStatus.chargesEnabled ? t("payments.canCharge") : t("payments.cannotCharge")} ·{" "}
                  {connectStatus.payoutsEnabled ? t("payments.payoutsActive") : t("payments.payoutsPending")}
                </p>
              )}
            </div>
            <Button className="gap-2" onClick={connect} disabled={connecting}>
              {connecting ? <Spinner className="size-4" /> : <ExternalLink size={16} />}
              {connectStatus.connected ? t("payments.continueSetup") : t("payments.connectStripe")}
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-status-error-fg">{error}</p>}
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck size={20} strokeWidth={1.75} className="text-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("payments.taxes")}</h2>
            <p className="text-xs text-muted-foreground">{t("payments.taxesNote")}</p>
          </div>
        </div>

        <div className="space-y-1.5 max-w-xs">
          <Select value={company?.province} onValueChange={setProvince} disabled={savingProvince}>
            <SelectTrigger>
              <SelectValue placeholder={t("payments.selectProvince")} />
            </SelectTrigger>
            <SelectContent>
              {(rates ?? []).map((r) => (
                <SelectItem key={r.province} value={r.province}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {currentRate && (
          <p className="text-xs text-muted-foreground">
            {currentRate.isHst
              ? `HST: ${(currentRate.hstRate * 100).toFixed(3)}%`
              : `GST: ${(currentRate.gstRate * 100).toFixed(2)}% + PST/QST: ${(currentRate.pstRate * 100).toFixed(3)}%`}
          </p>
        )}
      </Card>
    </div>
  );
}
