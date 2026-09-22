/**
 * El enlace con el que un negocio recomienda Logiciel Construction.
 *
 * Está enrutada y **no está en el menú**, a propósito. El programa no se ha
 * encendido: los enlaces se dan uno a uno y no hay alta pública. Poner la
 * entrada en el menú antes de eso sería enseñarle a todo el mundo una pantalla
 * que casi siempre diría «todavía no tienes enlace» — un control que no hace
 * nada, que es lo que esta casa no pone.
 *
 * Cuando se encienda, la línea del menú va en Ajustes junto a las demás: el
 * área ya está puesta en `AREA_DE_PANTALLA`, así que se filtra sola por rol.
 *
 * Lo que enseña es sólo lo suyo. Ni la lista de afiliados ni lo que gana otro:
 * esas tablas son nuestras y no se asoman por ninguna ruta de un negocio.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Link2, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AvisoDeFallo } from "@/components/AvisoDeFallo";
import { useApi } from "@/lib/api";

interface Panel {
  tieneEnlace: boolean;
  codigo?: string;
  estado?: "activo" | "suspendido" | "cancelado";
  firmado?: boolean;
  comisionPct?: number;
  referidos?: number;
  pagando?: number;
  devengadoCad?: number;
  pagadoCad?: number;
}

function Cifra({ que, valor }: { que: string; valor: string }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{valor}</p>
      <p className="text-sm text-muted-foreground mt-1">{que}</p>
    </Card>
  );
}

export default function SettingsAfiliados() {
  const { t, i18n } = useTranslation();
  const { data, loading, error, detalle, reload } = useApi<Panel>("/api/settings/afiliados");
  const [copiado, setCopiado] = useState(false);

  const enlace = data?.codigo ? `${window.location.origin}/?ref=${data.codigo}` : "";
  const dinero = (valor: number) =>
    new Intl.NumberFormat(i18n.language, { style: "currency", currency: "CAD" }).format(valor);

  const copiar = async () => {
    await navigator.clipboard.writeText(enlace);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1600);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl">
      <PageHeader title={t("afiliado.titulo")} description={t("afiliado.entradilla")} />

      {error && <AvisoDeFallo mensaje={error} detalle={detalle} onReintentar={reload} />}

      {!error && !data?.tieneEnlace && (
        <Card className="p-5 space-y-2">
          <h2 className="font-semibold text-foreground">{t("afiliado.sinEnlaceTitulo")}</h2>
          <p className="text-sm text-muted-foreground">{t("afiliado.sinEnlaceCuerpo")}</p>
        </Card>
      )}

      {!error && data?.tieneEnlace && (
        <>
          {data.estado === "suspendido" && (
            <Card className="p-4 border-status-warning-fg/30 bg-status-warning-bg flex gap-3">
              <TriangleAlert size={18} className="text-status-warning-fg shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="font-semibold text-status-warning-fg">{t("afiliado.suspendidoTitulo")}</h2>
                <p className="text-sm text-status-warning-fg/90">{t("afiliado.suspendidoCuerpo")}</p>
              </div>
            </Card>
          )}

          {/* Un enlace que apunta pero no paga tiene que decirlo antes de que
              alguien lo reparta: prometer una comisión que no se devenga es la
              forma más rápida de perder al afiliado y la confianza a la vez. */}
          {!data.firmado && (
            <Card className="p-4 border-status-warning-fg/30 bg-status-warning-bg flex gap-3">
              <TriangleAlert size={18} className="text-status-warning-fg shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="font-semibold text-status-warning-fg">{t("afiliado.sinFirmarTitulo")}</h2>
                <p className="text-sm text-status-warning-fg/90">{t("afiliado.sinFirmarCuerpo")}</p>
              </div>
            </Card>
          )}

          <Card className="p-5 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Link2 size={13} /> {t("afiliado.tuEnlace")}
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2">
              <code className="min-w-0 flex-1 truncate text-xs">{enlace}</code>
              <Button type="button" size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={copiar}>
                {copiado ? <Check size={14} /> : <Copy size={14} />}
                {copiado ? t("afiliado.copiado") : t("afiliado.copiar")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("afiliado.comision", { pct: data.comisionPct ?? 10 })}
            </p>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Cifra que={t("afiliado.referidos")} valor={String(data.referidos ?? 0)} />
            <Cifra que={t("afiliado.pagando")} valor={String(data.pagando ?? 0)} />
            <Cifra que={t("afiliado.devengado")} valor={dinero(data.devengadoCad ?? 0)} />
            <Cifra que={t("afiliado.pagado")} valor={dinero(data.pagadoCad ?? 0)} />
          </div>

          <Card className="p-5 space-y-2">
            <h2 className="font-semibold text-foreground">{t("afiliado.comoFunciona")}</h2>
            <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
              <li>{t("afiliado.regla1")}</li>
              <li>{t("afiliado.regla2")}</li>
              <li>{t("afiliado.regla3")}</li>
              <li>{t("afiliado.regla4")}</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
