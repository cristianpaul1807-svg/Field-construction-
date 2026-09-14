import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearch } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { ExternalLink, Unplug, CheckCircle2, AlertTriangle } from "lucide-react";
import { useApi, apiFetch, readJson, serverMessage } from "@/lib/api";

/**
 * La conexión con QuickBooks.
 *
 * Pantalla propia y no una pestaña de Pagos: Stripe es por dónde entra el
 * dinero y esto es a dónde van los libros. Se parecen en que los dos son «una
 * cuenta de fuera conectada», y en nada más.
 */

interface Estado {
  configured: boolean;
  connected: boolean;
  companyName: string | null;
  realmId: string | null;
  environment: "sandbox" | "production" | null;
  connectedAt: string | null;
  refreshExpiresAt: string | null;
}

export default function SettingsQuickBooks() {
  const { t, i18n } = useTranslation();
  const busqueda = useSearch();
  const [recarga, setRecarga] = useState(0);
  const { data: estado, loading } = useApi<Estado>(`/api/quickbooks/status?_r=${recarga}`);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La vuelta de Intuit trae el resultado en la dirección. Se lee una vez y se
  // limpia: si se queda ahí, un refresco de la página vuelve a anunciar una
  // conexión que se hizo hace media hora.
  const [resultado, setResultado] = useState<string | null>(null);
  useEffect(() => {
    const valor = new URLSearchParams(busqueda).get("quickbooks");
    if (!valor) return;
    setResultado(valor);
    window.history.replaceState({}, "", window.location.pathname);
    setRecarga((n) => n + 1);
  }, [busqueda]);

  const conectar = async () => {
    setOcupado(true);
    setError(null);
    try {
      const res = await apiFetch("/api/quickbooks/connect", { method: "POST" });
      const body = await readJson<{ url?: string; error?: string; code?: string }>(res);
      if (!res.ok || !body?.url) throw new Error(serverMessage(body, t, t("common.genericError")));
      // Se sale de la aplicación a propósito: la pantalla de Intuit tiene que
      // verse entera, con el nombre de la empresa que se está autorizando.
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
      setOcupado(false);
    }
  };

  const desconectar = async () => {
    if (!window.confirm(t("quickbooks.disconnectConfirm"))) return;
    setOcupado(true);
    setError(null);
    try {
      const res = await apiFetch("/api/quickbooks/disconnect", { method: "POST" });
      if (!res.ok) throw new Error(serverMessage(await readJson(res), t, t("common.genericError")));
      setResultado(null);
      setRecarga((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setOcupado(false);
    }
  };

  const fecha = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { dateStyle: "long" });

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title={t("quickbooks.title")} description={t("quickbooks.description")} />

      {resultado === "conectado" && (
        <div className="rounded-lg border border-status-success-bg bg-status-success-bg/40 p-4 text-sm text-status-success-fg flex items-center gap-2">
          <CheckCircle2 size={16} /> {t("quickbooks.justConnected")}
        </div>
      )}
      {resultado === "cancelado" && (
        <div className="rounded-lg border border-border bg-secondary p-4 text-sm text-muted-foreground">
          {t("quickbooks.cancelled")}
        </div>
      )}
      {resultado === "fallo" && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          {t("quickbooks.failed")}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}

      {!loading && estado && (
        <>
          {/* Sin claves en el servidor no hay nada que intentar, y un botón
              que lleva a un error no es un botón: es una pérdida de tiempo con
              forma de botón. */}
          {!estado.configured && (
            <Card className="p-6 space-y-2">
              <div className="flex items-center gap-2 text-status-warning-fg">
                <AlertTriangle size={16} strokeWidth={1.75} />
                <p className="text-sm font-medium">{t("quickbooks.notConfiguredTitle")}</p>
              </div>
              <p className="text-sm text-muted-foreground">{t("quickbooks.notConfiguredBody")}</p>
            </Card>
          )}

          {estado.configured && !estado.connected && (
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">{t("quickbooks.connectTitle")}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t("quickbooks.connectBody")}</p>
              </div>
              <Button className="gap-2" onClick={conectar} disabled={ocupado}>
                {ocupado ? <Spinner className="size-4" /> : <ExternalLink size={15} />}
                {t("quickbooks.connect")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("quickbooks.connectNote")}</p>
            </Card>
          )}

          {estado.connected && (
            <Card className="p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {estado.companyName ?? t("quickbooks.unnamedCompany")}
                  </h2>
                  {estado.connectedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("quickbooks.connectedOn", { date: fecha(estado.connectedAt) })}
                    </p>
                  )}
                </div>
                <StatusBadge tone="success">{t("quickbooks.connected")}</StatusBadge>
              </div>

              {/* Una conexión de pruebas parece una conexión buena hasta que
                  alguien busca sus facturas de verdad y no están. */}
              {estado.environment === "sandbox" && (
                <div className="rounded-lg border border-status-warning-bg bg-status-warning-bg/40 p-3">
                  <p className="text-xs text-status-warning-fg">{t("quickbooks.sandboxWarning")}</p>
                </div>
              )}

              <Button variant="outline" className="gap-2 text-status-error-fg" onClick={desconectar} disabled={ocupado}>
                {ocupado ? <Spinner className="size-4" /> : <Unplug size={15} />}
                {t("quickbooks.disconnect")}
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
