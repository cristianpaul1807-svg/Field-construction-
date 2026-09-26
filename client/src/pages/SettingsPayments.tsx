import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, ExternalLink, Receipt, ShieldCheck, Smartphone } from "lucide-react";
import { useApi, apiFetch, readJson, serverMessage, apiEnviar } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { PaymentPlanEditor } from "@/components/PaymentPlanEditor";

interface ConnectStatus {
  paymentsMode: "sin_definir" | "stripe" | "manual";
  connected: boolean;
  status: "pending" | "active" | "restricted";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  feesPayer: "account" | "application" | null;
  conexionPausada?: boolean;
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
  const [needsConnectSignup, setNeedsConnectSignup] = useState(false);
  const [platformNotActivated, setPlatformNotActivated] = useState(false);
  // Lo que dijo Stripe, tal cual. «Sin activar» agrupa varias causas —la
  // cuenta sin datos, el perfil de plataforma sin terminar— y el aviso no
  // puede distinguirlas; con esto, una captura basta para saber cuál es.
  const [detalleStripe, setDetalleStripe] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "completo") {
      apiFetch("/api/stripe/connect/refresh", { method: "POST" }).finally(() => setReloadToken((t) => t + 1));
    }
  }, []);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    setNeedsConnectSignup(false);
    setPlatformNotActivated(false);
    setDetalleStripe(null);
    try {
      const res = await apiFetch("/api/stripe/connect/onboarding-link", { method: "POST" });
      const body = await readJson(res);
      if (!res.ok) {
        // Connect not enabled on the platform account is not an error the
        // business can fix by retrying — it is a one-time signup — so it gets
        // its own explanation and a link, not a red sentence in English.
        if (body?.code === "stripe_connect_not_enabled") {
          setNeedsConnectSignup(true);
          setConnecting(false);
          return;
        }
        // La cuenta de la plataforma —la nuestra, no la suya— está sin
        // activar, y Stripe no deja crear cuentas conectadas hasta entonces.
        // No es culpa del contratista y no lo puede arreglar él, así que se
        // le dice eso y se le recuerda por dónde sí puede cobrar mientras
        // tanto. Antes caía en el mensaje genérico y parecía que el producto
        // estaba roto.
        if (body?.code === "stripe_connect_pausado") {
          setError(t("payments.connectPausedTitle"));
          setConnecting(false);
          return;
        }
        if (body?.code === "stripe_platform_not_activated") {
          setPlatformNotActivated(true);
          setDetalleStripe(typeof body?.error === "string" ? body.error : null);
          setConnecting(false);
          return;
        }
        // The stale row has already been cleared server-side, so the very
        // next press works. Saying "press it again" is more useful than
        // Stripe's "No such account".
        if (body?.code === "stripe_account_missing") {
          setError(t("payments.accountMissing"));
          setConnecting(false);
          return;
        }
        throw new Error(serverMessage(body, t, t("payments.connectError")));
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("payments.connectError"));
      setConnecting(false);
    }
  };

  const setProvince = async (province: string) => {
    setSavingProvince(true);
    try {
      await apiEnviar("/api/settings/company", {
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
            <Button className="gap-2" onClick={connect} disabled={connecting || !!connectStatus.conexionPausada}>
              {connecting ? <Spinner className="size-4" /> : <ExternalLink size={16} />}
              {connectStatus.connected ? t("payments.continueSetup") : t("payments.connectStripe")}
            </Button>
          </div>
        )}

        {/* Who pays Stripe's cut is fixed when the account is created and
            cannot be edited afterwards, so it is stated plainly rather than
            left to be discovered on a statement. */}
        {!loading && connectStatus?.connected && connectStatus.feesPayer === "account" && (
          <p className="text-xs text-muted-foreground">{t("payments.feesPaidByAccount")}</p>
        )}
        {!loading && connectStatus?.connected && connectStatus.feesPayer !== "account" && (
          <div className="rounded-lg border border-status-warning-fg/30 bg-status-warning-bg/40 p-4 space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("payments.feesPayerWrongTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("payments.feesPayerWrongBody")}</p>
          </div>
        )}

        {!loading && connectStatus?.paymentsMode === "manual" && !connectStatus.chargesEnabled && (
          <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("payments.modeManualTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("payments.modeManualBody")}</p>
          </div>
        )}

        {/* Un botón apagado sin decir por qué es peor que un botón que falla:
            el contratista se queda mirando algo que no responde y no sabe si
            es él, su plan o una avería. Así que el motivo va al lado, y con
            él lo que sí puede hacer hoy. */}
        {!loading && connectStatus?.conexionPausada && (
          <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("payments.connectPausedTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("payments.connectPausedBody")}</p>
            <p className="text-sm text-muted-foreground">{t("payments.connectPausedMeanwhile")}</p>
          </div>
        )}

        {/* No es suya y no la puede arreglar él: la cuenta sin activar es la
            de la plataforma. Así que no lleva enlace a Stripe —le mandaría a
            una página de una cuenta que no es la suya— y sí dice por dónde
            puede cobrar hoy, que es lo único accionable que tiene. */}
        {platformNotActivated && (
          <div className="rounded-lg border border-status-warning-fg/30 bg-status-warning-bg/40 p-4 space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("payments.platformNotActivatedTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("payments.platformNotActivatedBody")}</p>
            <p className="text-sm text-muted-foreground">{t("payments.platformNotActivatedMeanwhile")}</p>
            {detalleStripe && (
              <p className="text-xs text-muted-foreground break-words pt-1">
                {t("payments.detalleParaSoporte")}: {detalleStripe}
              </p>
            )}
          </div>
        )}

        {needsConnectSignup && (
          <div className="rounded-lg border border-status-warning-fg/30 bg-status-warning-bg/40 p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">{t("payments.connectNotEnabledTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("payments.connectNotEnabledBody")}</p>
            <a
              href="https://dashboard.stripe.com/connect"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              {t("payments.connectNotEnabledAction")} <ExternalLink size={13} strokeWidth={1.75} />
            </a>
          </div>
        )}
        {error && <p className="text-sm text-status-error-fg">{error}</p>}
      </Card>

      {/* El móvil como datáfono.

          Va aquí y no escondido en la ayuda porque la pregunta llega en la
          obra, con el cliente delante y la tarjeta en la mano, y la respuesta
          que encuentra el contratista suele ser un comercial vendiéndole un
          terminal con cuota mensual. Ya tiene uno: la cuenta que crea desde
          esta pantalla es una cuenta Stripe completa —`dashboard: "full"`—,
          así que entra en la app de Stripe con ella y su teléfono cobra.

          Los dos avisos de abajo no son letra pequeña. Sin el primero cobra y
          deja la factura diciendo que está pendiente; sin el segundo se queda
          plantado delante del cliente cuando una tarjeta no pasa, que en
          Canadá ocurre a menudo porque muchas piden el PIN insertadas. */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Smartphone size={20} strokeWidth={1.75} className="text-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{t("payments.phoneTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("payments.phoneNote")}</p>
          </div>
        </div>

        {!loading && !connectStatus?.chargesEnabled && (
          <p className="text-sm text-muted-foreground">{t("payments.phoneNeedsConnect")}</p>
        )}

        <ol className="space-y-3">
          {["phoneStep1", "phoneStep2", "phoneStep3", "phoneStep4"].map((paso, i) => (
            <li key={paso} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary text-xs font-medium text-foreground flex items-center justify-center tabular-nums">
                {i + 1}
              </span>
              <span className="text-sm text-muted-foreground min-w-0">{t(`payments.${paso}`)}</span>
            </li>
          ))}
        </ol>

        <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-2">
          <p className="text-sm text-muted-foreground">{t("payments.phoneMarkPaid")}</p>
          <p className="text-sm text-muted-foreground">{t("payments.phoneOfflinePin")}</p>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Receipt size={20} strokeWidth={1.75} className="text-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("paymentPlan.settingsTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("paymentPlan.settingsNote")}</p>
          </div>
        </div>
        <PaymentPlanEditor />
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
