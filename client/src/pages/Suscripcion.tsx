/**
 * Lo que el negocio nos paga a nosotros.
 *
 * Cuidado con no confundirla con Ajustes → Pagos, que es lo contrario: allí se
 * conecta la cuenta con la que **el contratista cobra a sus clientes**, y el
 * dinero va a su bolsillo. Aquí el dinero viene al nuestro. Son dos cuentas de
 * Stripe distintas y dos pantallas distintas a propósito, y por eso la
 * entradilla lo dice en la primera línea.
 *
 * Cambiar de plan, cambiar la tarjeta, cancelar y descargar facturas **no se
 * hacen aquí**: se hacen en el portal de Stripe. Ya está traducido, con sus
 * confirmaciones y sus reglas de prorrateo, y cada una de esas pantallas
 * escrita por nosotros sería una forma más de equivocarnos con el dinero de
 * alguien. Aquí sólo se elige plan la primera vez y se ve en qué se está.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Spinner } from "@/components/ui/spinner";
import { Check, ExternalLink, TriangleAlert } from "lucide-react";
import { apiFetch, readJson } from "@/lib/api";
import { PLANES_DE_PAGO, type Periodo, type PlanDePago } from "@shared/planes";

type Estado = {
  plan: string;
  estado: string | null;
  periodo: string | null;
  renuevaEl: string | null;
  seCancelaAlFinal: boolean;
  pruebaHasta: string | null;
  tienePortal: boolean;
  precios: Partial<Record<string, { mes: number; ano: number; moneda: string }>>;
};

export default function Suscripcion() {
  const { t, i18n } = useTranslation();
  const [ubicacion, navegar] = useLocation();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [yendo, setYendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La vuelta desde Stripe. El webhook y el navegador corren una carrera que
  // el navegador suele ganar, así que el aviso dice que recargue si todavía no
  // lo ve — en vez de enseñar el plan viejo y que parezca que no se cobró.
  const params = new URLSearchParams(ubicacion.split("?")[1] ?? "");
  const vuelta = params.get("pago");

  useEffect(() => {
    let vivo = true;
    apiFetch("/api/suscripcion")
      .then(readJson<Estado>)
      .then((d) => vivo && setEstado(d))
      .catch(() => vivo && setEstado(null));
    return () => {
      vivo = false;
    };
  }, []);

  const fecha = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" }) : "";

  async function ir(ruta: string, cuerpo: Record<string, unknown>, marca: string) {
    setYendo(marca);
    setError(null);
    try {
      const res = await apiFetch(ruta, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cuerpo, lang: i18n.language }),
      });
      const b = await readJson<{ url?: string; code?: string }>(res);
      if (b.url) {
        // Stripe, no una pestaña nueva: en el móvil una pestaña nueva se pierde
        // y la persona se queda sin saber si pagó.
        window.location.href = b.url;
        return;
      }
      setError(b.code === "stripe_not_configured" ? t("susc.stripeSinConfigurar") : t("susc.noSePudo"));
    } catch {
      setError(t("susc.noSePudo"));
    } finally {
      setYendo(null);
    }
  }

  if (!estado) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("common.loading")}
      </div>
    );
  }

  const contratado = PLANES_DE_PAGO.includes(estado.plan as PlanDePago);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl">
      <PageHeader title={t("susc.titulo")} description={t("susc.entradilla")} />

      {vuelta === "exitoso" && (
        <Card className="p-4 border-status-success-fg/30 bg-status-success-bg">
          <p className="text-sm text-status-success-fg">{t("susc.pagoExitoso")}</p>
        </Card>
      )}
      {vuelta === "cancelado" && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">{t("susc.pagoCancelado")}</p>
        </Card>
      )}

      {estado.estado === "past_due" && (
        <Card className="p-4 border-status-warning-fg/30 bg-status-warning-bg flex gap-3">
          <TriangleAlert size={18} className="text-status-warning-fg shrink-0 mt-0.5" />
          <p className="text-sm text-status-warning-fg">{t("susc.impagoAviso")}</p>
        </Card>
      )}

      {/* En qué está hoy */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              {t("susc.planActual")}
            </p>
            <p className="text-lg font-semibold text-foreground mt-1">
              {contratado ? t(`planes.${estado.plan}`, estado.plan) : t("susc.sinPlan")}
            </p>
          </div>
          {estado.estado && (
            <span className="text-xs font-medium rounded-full bg-secondary px-3 py-1.5">
              {t(`susc.estado.${estado.estado}`, estado.estado)}
            </span>
          )}
        </div>

        {estado.pruebaHasta && estado.estado === "trialing" && (
          <p className="text-sm text-muted-foreground">{t("susc.pruebaHasta", { fecha: fecha(estado.pruebaHasta) })}</p>
        )}
        {estado.renuevaEl && estado.estado !== "trialing" && (
          <p className="text-sm text-muted-foreground">
            {estado.seCancelaAlFinal
              ? t("susc.terminaEl", { fecha: fecha(estado.renuevaEl) })
              : t("susc.renuevaEl", { fecha: fecha(estado.renuevaEl) })}
          </p>
        )}

        {estado.tienePortal && (
          <div className="pt-1 space-y-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={yendo === "portal"}
              onClick={() => void ir("/api/suscripcion/portal", {}, "portal")}
            >
              <ExternalLink size={15} strokeWidth={1.75} />
              {yendo === "portal" ? t("susc.abriendo") : t("susc.gestionar")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("susc.gestionarNota")}</p>
          </div>
        )}
      </Card>

      {/* Elegir plan. Sólo si todavía no hay nada contratado: quien ya paga
          cambia de plan en el portal, donde Stripe hace el prorrateo bien. */}
      {!contratado && (
        <>
          <div className="inline-flex rounded-lg border border-border p-1 gap-1">
            {(["mes", "ano"] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  periodo === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "mes" ? t("susc.mensual") : t("susc.anual")}
                {p === "ano" && (
                  <span className="ml-1.5 text-[10px] font-semibold opacity-80">{t("susc.dosMesesGratis")}</span>
                )}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {PLANES_DE_PAGO.map((plan) => {
              const precio = estado.precios[plan];
              if (!precio) return null;
              return (
                <Card key={plan} className="p-5 space-y-3 flex flex-col">
                  <h3 className="font-semibold text-foreground">{t(`planes.${plan}`, plan)}</h3>
                  <p className="text-2xl font-bold text-foreground">
                    {periodo === "mes"
                      ? t("susc.porMes", { precio: precio.mes, moneda: precio.moneda })
                      : t("susc.porAno", { precio: precio.ano, moneda: precio.moneda })}
                  </p>
                  <p className="text-xs text-muted-foreground flex-1">{t("susc.impuestosAparte")}</p>
                  <Button
                    className="w-full gap-2"
                    disabled={yendo === plan}
                    onClick={() => void ir("/api/suscripcion/checkout", { plan, periodo }, plan)}
                  >
                    {yendo === plan ? (
                      t("susc.abriendo")
                    ) : (
                      <>
                        <Check size={15} strokeWidth={2.2} />
                        {t("susc.elegir")}
                      </>
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">{t("susc.pruebaIncluida")}</p>
        </>
      )}

      {error && <p className="text-sm text-status-danger-fg">{error}</p>}
      {/* `navegar` se usa sólo para limpiar el ?pago= de la barra al salir. */}
      {vuelta && (
        <button
          className="text-xs text-muted-foreground underline"
          onClick={() => navegar("/suscripcion", { replace: true })}
        >
          {t("common.close")}
        </button>
      )}
    </div>
  );
}
