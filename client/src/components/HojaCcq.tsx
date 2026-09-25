/**
 * La hoja mensual de la CCQ.
 *
 * Sale sólo si el negocio se ha declarado sujeto a la CCQ, en los datos de la
 * empresa. Para quien no lo sea es una tarjeta que no significa nada, y una
 * pantalla llena de cosas que no van contigo es cómo se deja de mirar la
 * pantalla.
 *
 * No manda nada a la CCQ: es lo que el contratista copia en su formulario. El
 * archivo que ellos importan tiene un formato que no publican.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Download, HardHat } from "lucide-react";
import { toast } from "sonner";
import { useApi, downloadFile } from "@/lib/api";

interface Linea {
  trabajador: string;
  semana: string;
  horas: number;
  horasExtra: number;
  oficio: string | null;
  estatuto: string | null;
  sector: string | null;
  region: string | null;
  falta: string[];
}

interface Hoja {
  month: string;
  subject: boolean;
  employerNumber: string | null;
  lines: Linea[];
  totalHours: number;
  incomplete: number;
}

export function HojaCcq() {
  const { t } = useTranslation();
  // El mes pasado por defecto: la declaración vence el 15, así que quien abre
  // esto en septiembre viene a declarar agosto.
  const [mes, setMes] = useState(() => {
    const d = new Date();
    d.setDate(0);
    return d.toISOString().slice(0, 7);
  });
  const { data, loading } = useApi<Hoja>(`/api/ccq/monthly?month=${mes}`);
  const [bajando, setBajando] = useState(false);

  /**
   * Bajar el informe de la CCQ.
   *
   * Esto se hacía a mano, sin mirar la respuesta: si el servidor fallaba,
   * `res.blob()` recogía el JSON del error y se descargaba igual, con nombre
   * `ccq-2026-09.csv`. El contratista entregaba a la Comisión un «CSV» que
   * dentro decía `{"error": …}` — un documento obligatorio estropeado sin que
   * nada lo avisara. Además revocaba el enlace en el mismo instante del clic,
   * que en algunos navegadores cancela la descarga.
   *
   * `downloadFile` ya resolvía las dos cosas. Tener un segundo camino para lo
   * mismo es como uno de los dos se queda sin el arreglo.
   */
  const descargar = async () => {
    setBajando(true);
    try {
      await downloadFile(`/api/ccq/monthly?month=${mes}&format=csv`, `ccq-${mes}.csv`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errores.generico"));
    } finally {
      setBajando(false);
    }
  };

  if (!loading && !data?.subject) return null;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground inline-flex items-center gap-2">
            <HardHat size={16} strokeWidth={1.75} className="text-muted-foreground" />
            {t("ccq.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t("ccq.description")}</p>
        </div>
        <Input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="h-9 w-auto text-sm"
        />
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Spinner className="size-4" /> {t("common.loading")}
        </p>
      )}

      {!loading && data && (
        <>
          {data.lines.length === 0 ? (
            /* Hay que declarar aunque no se haya trabajado, y eso es
               exactamente lo que se olvida el mes que no hubo obra. */
            <p className="text-sm text-status-warning-fg">{t("ccq.noHours")}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-foreground">{t("ccq.totalHours", { hours: data.totalHours })}</span>
                {data.incomplete > 0 && (
                  <StatusBadge tone="warning">{t("ccq.incomplete", { count: data.incomplete })}</StatusBadge>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3 font-medium">{t("ccq.worker")}</th>
                      <th className="py-2 pr-3 font-medium">{t("ccq.week")}</th>
                      <th className="py-2 pr-3 font-medium text-right">{t("ccq.hours")}</th>
                      <th className="py-2 pr-3 font-medium text-right">{t("ccq.overtime")}</th>
                      <th className="py-2 pr-3 font-medium">{t("ccq.trade")}</th>
                      <th className="py-2 pr-3 font-medium">{t("ccq.status")}</th>
                      <th className="py-2 pr-3 font-medium">{t("ccq.sector")}</th>
                      <th className="py-2 font-medium">{t("ccq.region")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((l) => (
                      <tr key={`${l.trabajador}-${l.semana}`} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3 text-foreground whitespace-nowrap">{l.trabajador}</td>
                        <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{l.semana}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{l.horas.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{l.horasExtra.toFixed(2)}</td>
                        {/* Lo que falta se dice en su propia casilla, no en un
                            aviso aparte: así se ve de un vistazo a quién hay
                            que completarle el acuerdo. */}
                        <Casilla valor={l.oficio} />
                        <Casilla valor={l.estatuto ? t(`ccq.statusValue.${l.estatuto}`, { defaultValue: l.estatuto }) : null} />
                        <Casilla valor={l.sector ? t(`ccq.sectorValue.${l.sector}`, { defaultValue: l.sector }) : null} />
                        <Casilla valor={l.region} ultima />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.incomplete > 0 && <p className="text-xs text-status-warning-fg">{t("ccq.fixIt")}</p>}
            </>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={descargar} disabled={bajando || data.lines.length === 0}>
              {bajando ? <Spinner className="size-4" /> : <Download size={15} />}
              {t("ccq.download")}
            </Button>
            {data.employerNumber && (
              <span className="text-xs text-muted-foreground">
                {t("ccq.employerNumber", { number: data.employerNumber })}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{t("ccq.note")}</p>
        </>
      )}
    </Card>
  );
}

function Casilla({ valor, ultima }: { valor: string | null; ultima?: boolean }) {
  const { t } = useTranslation();
  return (
    <td className={`py-2 ${ultima ? "" : "pr-3"} whitespace-nowrap`}>
      {valor ? (
        <span className="text-foreground">{valor}</span>
      ) : (
        <span className="text-status-warning-fg">{t("ccq.missing")}</span>
      )}
    </td>
  );
}
