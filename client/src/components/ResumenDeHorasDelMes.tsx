import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AvisoDeFallo } from "@/components/AvisoDeFallo";
import { useApi, downloadFile } from "@/lib/api";
import { TIPOS_DE_AUSENCIA, type TipoDeAusencia } from "@shared/ausencias";
import { useNombresDelMenu } from "@/lib/nombresDelMenu";

interface Persona {
  id: string;
  nombre: string;
  puesto: string | null;
  totales: { ordinarias: number; extraordinarias: number; ausencias: Record<TipoDeAusencia, number> };
}

interface Resumen {
  mes: string;
  personas: Persona[];
  sinAprobar: number;
}

/** El mes pasado: es el que se le manda al consulente a principios de éste. */
function mesPasado(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Las horas del mes para quien hace la nómina.
 *
 * En Italia la nómina la hace el consulente del lavoro, y lo que necesita de
 * la empresa es esto: por persona, horas ordinarias, extraordinarias y los
 * días de cada ausencia. Aquí se ve el total y se descarga el detalle día a
 * día en un archivo que abre cualquier hoja de cálculo. Ver
 * `server/resumenDeHoras.ts`.
 */
export function ResumenDeHorasDelMes() {
  const { t, i18n } = useTranslation();
  const [mes, setMes] = useState(mesPasado);
  const [bajando, setBajando] = useState(false);
  const [falloBajada, setFalloBajada] = useState<string | null>(null);
  const menu = useNombresDelMenu();
  const { data, loading, error, detalle, reload } = useApi<Resumen>(mes ? `/api/work-log/hours-summary?month=${mes}` : null);

  const descargar = async () => {
    setBajando(true);
    setFalloBajada(null);
    try {
      await downloadFile(`/api/work-log/hours-summary?month=${mes}&format=csv&lang=${i18n.language.slice(0, 2)}`, `${t("hoursSummary.fileName")}-${mes}.csv`);
    } catch (err) {
      setFalloBajada(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setBajando(false);
    }
  };

  // «6,5» y no «6.5» donde la coma es el decimal: quien lo lee compara con su
  // propia hoja de horas.
  const horas = (n: number) => n.toLocaleString(i18n.language, { maximumFractionDigits: 2 });

  const ausenciasDe = (p: Persona) =>
    TIPOS_DE_AUSENCIA.filter((k) => p.totales.ausencias[k] > 0)
      .map((k) => `${t(`timeOff.kind.${k}`)}: ${t("hoursSummary.days", { count: p.totales.ausencias[k] })}`)
      .join(" · ");

  return (
    <Card className="p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <CalendarRange size={18} strokeWidth={1.75} className="text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{t("hoursSummary.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("hoursSummary.description")}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="resumen-mes">{t("hoursSummary.month")}</Label>
          <Input id="resumen-mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-full sm:w-48" />
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void descargar()} disabled={!mes || bajando || !data}>
          {bajando ? <Spinner className="size-4" /> : <Download size={15} />}
          {t("hoursSummary.download")}
        </Button>
      </div>

      {falloBajada && <p className="text-sm text-status-error-fg">{falloBajada}</p>}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}
      {error && <AvisoDeFallo mensaje={t("common.loadError", { message: error })} detalle={detalle} onReintentar={reload} />}

      {data && !loading && (
        <div className="space-y-2">
          {/* Lo que no entra, dicho. Un resumen que sale corto sin avisar es
              una nómina que se paga corta. */}
          {data.sinAprobar > 0 && (
            <p className="text-xs text-status-warning-fg">{t("hoursSummary.unapproved", { count: data.sinAprobar, ...menu })}</p>
          )}
          {data.personas.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("hoursSummary.empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.personas.map((p) => (
                <li key={p.id} className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.nombre}</p>
                    {ausenciasDe(p) && <p className="text-xs text-muted-foreground break-words">{ausenciasDe(p)}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {t("hoursSummary.totals", { regular: horas(p.totales.ordinarias), overtime: horas(p.totales.extraordinarias) })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
