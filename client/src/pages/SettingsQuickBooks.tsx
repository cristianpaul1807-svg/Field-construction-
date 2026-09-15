import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearch } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { ExternalLink, Unplug, CheckCircle2, AlertTriangle, Stethoscope, Copy, Check, RefreshCw, ChevronDown } from "lucide-react";
import { useApi, apiFetch, readJson, serverMessage } from "@/lib/api";

/**
 * La conexión con QuickBooks.
 *
 * Pantalla propia y no una pestaña de Pagos: Stripe es por dónde entra el
 * dinero y esto es a dónde van los libros. Se parecen en que los dos son «una
 * cuenta de fuera conectada», y en nada más.
 */

/**
 * Lo que no ha llegado a QuickBooks.
 *
 * Un sitio y no una insignia repartida por cinco pantallas: la pregunta que se
 * hace un contratista no es «¿llegó esta factura?», es «¿está mi contabilidad
 * al día?», y esa no se contesta mirando pantalla por pantalla.
 *
 * El mensaje de Intuit no se enseña de entrada. Está escrito para quien
 * programa —habla de validaciones, de tokens, de objetos obsoletos— y delante
 * de un contratista no dice si el problema es suyo, nuestro o de nadie. Se
 * enseña qué hacer, y el original queda debajo para quien lo necesite.
 */
function LoQueFalta({ onChanged }: { onChanged: () => void }) {
  const { t } = useTranslation();
  const [recarga, setRecarga] = useState(0);
  const { data: pendientes, loading } = useApi<
    { kind: string; id: string; label: string; status: string; error: string | null; fix: string }[]
  >(`/api/quickbooks/pending?_r=${recarga}`);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const reintentar = async (kind: string, id: string) => {
    setOcupado(id);
    await apiFetch(`/api/quickbooks/retry/${kind}/${id}`, { method: "POST" }).catch(() => null);
    setOcupado(null);
    setRecarga((n) => n + 1);
    onChanged();
  };

  const reintentarTodo = async () => {
    setOcupado("todo");
    // De uno en uno: veinte llamadas a la vez a Intuit es como se consigue que
    // te limite, y entonces fallan las veinte.
    for (const p of pendientes ?? []) {
      await apiFetch(`/api/quickbooks/retry/${p.kind}/${p.id}`, { method: "POST" }).catch(() => null);
    }
    setOcupado(null);
    setRecarga((n) => n + 1);
    onChanged();
  };

  if (loading) return null;

  if ((pendientes ?? []).length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-status-success-fg">
          <CheckCircle2 size={16} strokeWidth={1.75} />
          <p className="text-sm font-medium">{t("quickbooks.allSynced")}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{t("quickbooks.allSyncedHint")}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("quickbooks.pendingTitle")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("quickbooks.pendingCount", { count: pendientes!.length })}
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={reintentarTodo} disabled={ocupado !== null}>
          {ocupado === "todo" ? <Spinner className="size-3.5" /> : <RefreshCw size={13} />}
          {t("quickbooks.retryAll")}
        </Button>
      </div>

      <div className="divide-y divide-border">
        {pendientes!.map((p) => (
          <div key={`${p.kind}-${p.id}`} className="py-3 first:pt-0 last:pb-0 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  {t(`quickbooks.kind.${p.kind}`)}
                  {p.label && <span className="text-muted-foreground"> · {p.label}</span>}
                </p>
                {/* Qué hacer, no qué dijo Intuit. */}
                <p className="text-xs text-status-warning-fg mt-0.5">{t(`quickbooks.fix.${p.fix}`)}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 min-h-11 sm:min-h-0"
                onClick={() => reintentar(p.kind, p.id)}
                disabled={ocupado !== null}
              >
                {ocupado === p.id ? <Spinner className="size-3.5" /> : <RefreshCw size={12} />}
                {t("quickbooks.rowRetry")}
              </Button>
            </div>

            {p.error && (
              <div>
                <button
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  onClick={() => setAbierto(abierto === p.id ? null : p.id)}
                >
                  <ChevronDown size={11} className={abierto === p.id ? "rotate-180 transition-transform" : "transition-transform"} />
                  {t("quickbooks.showDetail")}
                </button>
                {abierto === p.id && (
                  <pre className="mt-1 text-[11px] leading-snug bg-secondary rounded-md p-2 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                    {p.error}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

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

  // El diagnóstico va en un botón y no en una dirección que se abra a mano:
  // esta ruta es del panel y necesita la sesión, que una pestaña nueva no
  // manda. Abierta a pelo devolvía una página en blanco, que es la peor forma
  // de decir "no tienes permiso".
  const [informe, setInforme] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const diagnosticar = async () => {
    setOcupado(true);
    setError(null);
    try {
      const res = await apiFetch("/api/quickbooks/diagnostics");
      const body = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(body, t, t("common.genericError")));
      setInforme(JSON.stringify(body, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setOcupado(false);
    }
  };

  const copiar = async () => {
    if (!informe) return;
    await navigator.clipboard.writeText(informe);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title={t("quickbooks.title")} description={t("quickbooks.description")} />

      {resultado === "conectado" && estado?.connected && (
        <div className="rounded-lg border border-status-success-bg bg-status-success-bg/40 p-4 text-sm text-status-success-fg flex items-center gap-2">
          <CheckCircle2 size={16} /> {t("quickbooks.justConnected")}
        </div>
      )}
      {/* El aviso de fallo sólo si de verdad no hay conexión.
          Intuit puede volver aquí dos veces —una recarga, un botón atrás— y la
          segunda se encuentra el `state` ya gastado y contesta que falló,
          cuando la primera había conectado perfectamente. Sin esta condición
          la pantalla decía las dos cosas a la vez: "no pudimos conectar"
          arriba y "Conectado" justo debajo. Manda el estado, no la URL. */}
      {resultado === "cancelado" && !estado?.connected && (
        <div className="rounded-lg border border-border bg-secondary p-4 text-sm text-muted-foreground">
          {t("quickbooks.cancelled")}
        </div>
      )}
      {resultado === "fallo" && !estado?.connected && (
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

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2" onClick={diagnosticar} disabled={ocupado}>
                  {ocupado ? <Spinner className="size-4" /> : <Stethoscope size={15} />}
                  {t("quickbooks.diagnose")}
                </Button>
                <Button variant="outline" className="gap-2 text-status-error-fg" onClick={desconectar} disabled={ocupado}>
                  <Unplug size={15} /> {t("quickbooks.disconnect")}
                </Button>
              </div>

              {informe && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{t("quickbooks.diagnoseHint")}</p>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={copiar}>
                    {copiado ? <Check size={13} /> : <Copy size={13} />}
                    {copiado ? t("invoicing.copied") : t("quickbooks.diagnoseCopy")}
                  </Button>
                  {/* En un móvil un bloque de texto largo empuja la página de
                      lado si no se le pone freno. Se desplaza él, dentro de su
                      caja. */}
                  <pre className="text-[11px] leading-snug bg-secondary rounded-lg p-3 max-h-80 overflow-auto whitespace-pre-wrap break-all">
                    {informe}
                  </pre>
                </div>
              )}
            </Card>
          )}

          {estado.connected && <LoQueFalta onChanged={() => setRecarga((n) => n + 1)} />}
        </>
      )}
    </div>
  );
}
