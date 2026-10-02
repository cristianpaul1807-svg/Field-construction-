import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileText, Plus, Receipt, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiEnviar, downloadFile, readJson, serverMessage, apiFetch, useApi } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/mockData";
import { calcolaSal, type RigaContratto } from "@shared/sal";

interface SalGuardado {
  id: string;
  numero: number;
  data: string;
  importoCumulato: number;
  importo: number;
  recuperoAcconto: number;
  note: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
}

interface EstadoSal {
  righe: (RigaContratto & { percentualePrecedente: number })[];
  contratto: number;
  acconti: number;
  accontoGiaRecuperato: number;
  cumulatoPrecedente: number;
  sal: SalGuardado[];
}

const hoy = () => new Date().toLocaleDateString("en-CA");

/**
 * Los SAL de la obra: certificar lo hecho partida a partida y facturarlo.
 *
 * Arriba, cuánto vale el contrato y cuánto va certificado, que es lo que se
 * pregunta antes de nada. Debajo, cada SAL con su PDF y su factura. El nuevo
 * se abre aparte porque es una lista de partidas: en un móvil no cabe al lado
 * de nada.
 *
 * Mientras se escriben los porcentajes, la cuenta se hace aquí con la misma
 * función que usa el servidor, así que lo que se ve antes de guardar es lo
 * que se guarda.
 */
export function SalDeLaObra({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation();
  const { data, loading, reload } = useApi<EstadoSal>(`/api/projects/${projectId}/sal`);
  const [abierto, setAbierto] = useState(false);
  const [avance, setAvance] = useState<Record<string, string>>({});
  const [fecha, setFecha] = useState(hoy());
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const calculo = useMemo(() => {
    if (!data) return null;
    const avanzamento: Record<string, number> = {};
    for (const [k, v] of Object.entries(avance)) if (v.trim() !== "") avanzamento[k] = Number(v.replace(",", "."));
    return calcolaSal({
      righe: data.righe,
      avanzamento,
      avanzamentoPrecedente: Object.fromEntries(data.righe.map((r) => [r.chiave, r.percentualePrecedente])),
      cumulatoPrecedente: data.cumulatoPrecedente,
      acconti: data.acconti,
      accontoGiaRecuperato: data.accontoGiaRecuperato,
    });
  }, [data, avance]);

  if (loading && !data) {
    return (
      <Card className="p-6">
        <Spinner className="size-4" />
      </Card>
    );
  }
  if (!data) return null;

  const abrir = () => {
    setAvance({});
    setFecha(hoy());
    setNota("");
    setError(null);
    setAbierto(true);
  };

  const certificar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const avanzamento: Record<string, number> = {};
      for (const [k, v] of Object.entries(avance)) if (v.trim() !== "") avanzamento[k] = Number(v.replace(",", "."));
      const res = await apiFetch(`/api/projects/${projectId}/sal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avanzamento, data: fecha, note: nota }),
      });
      const cuerpo = await readJson<{ code?: string; partidas?: string[] }>(res);
      if (!res.ok) {
        const base = serverMessage(cuerpo, t, t("common.genericError"));
        throw new Error(cuerpo?.partidas?.length ? `${base} ${cuerpo.partidas.join(" · ")}` : base);
      }
      setAbierto(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setGuardando(false);
    }
  };

  const facturar = async (sal: SalGuardado) => {
    setOcupado(sal.id);
    try {
      await apiEnviar(`/api/sal/${sal.id}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: i18n.language?.slice(0, 2) }),
      });
      toast.success(t("sal.facturada", { numero: sal.numero }));
      reload();
    } catch {
      // apiEnviar ya ha avisado.
    } finally {
      setOcupado(null);
    }
  };

  const borrar = async (sal: SalGuardado) => {
    if (!window.confirm(t("sal.confirmarBorrar", { numero: sal.numero }))) return;
    setOcupado(sal.id);
    try {
      await apiEnviar(`/api/sal/${sal.id}`, { method: "DELETE" });
      reload();
    } catch {
      // apiEnviar ya ha avisado.
    } finally {
      setOcupado(null);
    }
  };

  const pdf = async (sal: SalGuardado) => {
    try {
      await downloadFile(`/api/sal/${sal.id}/pdf?lang=${i18n.language?.slice(0, 2) ?? "es"}&download=1`, `SAL-${sal.numero}.pdf`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.genericError"));
    }
  };

  const certificado = data.cumulatoPrecedente;
  const ultimo = data.sal[data.sal.length - 1];
  const completa = data.contratto > 0 && certificado >= data.contratto;

  return (
    <Card className="p-6 gap-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground text-sm">{t("sal.title")}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t("sal.hint")}</p>
        </div>
        {data.righe.length > 0 && !completa && (
          <Button size="sm" className="gap-2 shrink-0" onClick={abrir}>
            <Plus size={14} strokeWidth={1.75} /> {t("sal.nuevo")}
          </Button>
        )}
      </div>

      {data.righe.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{t("sal.sinContrato")}</p>
      ) : (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-3 min-w-0">
              <dt className="text-xs text-muted-foreground">{t("sal.contratto")}</dt>
              <dd className="text-base font-semibold text-foreground break-words">{formatCurrency(data.contratto)}</dd>
            </div>
            <div className="rounded-lg border border-border p-3 min-w-0">
              <dt className="text-xs text-muted-foreground">{t("sal.certificado")}</dt>
              <dd className="text-base font-semibold text-foreground break-words">
                {formatCurrency(certificado)}
                {data.contratto > 0 && <span className="text-xs font-normal text-muted-foreground"> · {formatPercent(certificado / data.contratto)}</span>}
              </dd>
            </div>
            {data.acconti > 0 && (
              <div className="rounded-lg border border-border p-3 min-w-0">
                <dt className="text-xs text-muted-foreground">{t("sal.anticipo")}</dt>
                <dd className="text-base font-semibold text-foreground break-words">
                  {formatCurrency(data.acconti)}
                  <span className="block text-xs font-normal text-muted-foreground">{t("sal.recuperado", { importe: formatCurrency(data.accontoGiaRecuperato) })}</span>
                </dd>
              </div>
            )}
          </dl>

          <div className="space-y-0">
            {data.sal.map((sal) => {
              const facturaViva = sal.invoiceId && sal.invoiceStatus !== "cancelado";
              const daFatturare = Math.round((sal.importo - sal.recuperoAcconto) * 100) / 100;
              return (
                <div key={sal.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{t("sal.numero", { numero: sal.numero })} · {sal.data}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {t("sal.lineaImporte", { importe: formatCurrency(sal.importo), acumulado: formatCurrency(sal.importoCumulato) })}
                      {sal.recuperoAcconto > 0 && ` · ${t("sal.lineaRecupero", { importe: formatCurrency(sal.recuperoAcconto) })}`}
                    </p>
                    {sal.note && <p className="text-xs text-muted-foreground break-words">{sal.note}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void pdf(sal)}>
                      <FileText size={13} strokeWidth={1.75} /> PDF
                    </Button>
                    {facturaViva ? (
                      <span className="text-xs text-muted-foreground">{t("sal.factura", { numero: sal.invoiceNumber ?? "" })}</span>
                    ) : (
                      <Button size="sm" className="gap-1.5" disabled={ocupado === sal.id || daFatturare <= 0} onClick={() => void facturar(sal)}>
                        {ocupado === sal.id ? <Spinner className="size-3.5" /> : <Receipt size={13} strokeWidth={1.75} />}
                        {t("sal.facturar", { importe: formatCurrency(daFatturare) })}
                      </Button>
                    )}
                    {sal.id === ultimo?.id && !facturaViva && (
                      <Button size="sm" variant="ghost" aria-label={t("sal.borrar")} title={t("sal.borrar")} disabled={ocupado === sal.id} onClick={() => void borrar(sal)}>
                        <Trash2 size={14} strokeWidth={1.75} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {data.sal.length === 0 && <p className="text-sm text-muted-foreground py-2">{t("sal.ninguno")}</p>}
          </div>
        </>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("sal.numero", { numero: (ultimo?.numero ?? 0) + 1 })}</DialogTitle>
            <DialogDescription>{t("sal.dialogHint")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {data.righe.map((r) => {
              const fila = calculo?.righe.find((x) => x.chiave === r.chiave);
              const hecha = r.percentualePrecedente >= 100;
              return (
                <div key={r.chiave} className="flex flex-col sm:flex-row sm:items-center gap-2 border-b border-border pb-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground break-words">
                      {r.zona ? <span className="text-muted-foreground">{r.zona} · </span> : null}
                      {r.descrizione}
                    </p>
                    <p className="text-xs text-muted-foreground break-words">
                      {t("sal.filaContrato", {
                        importe: formatCurrency(r.importo),
                        cantidad: formatNumber(r.quantita),
                        anterior: formatNumber(r.percentualePrecedente),
                      })}
                      {fila && fila.questo > 0 && <span className="text-foreground"> · {t("sal.filaEste", { importe: formatCurrency(fila.questo) })}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative w-24">
                      <Input
                        inputMode="decimal"
                        aria-label={t("sal.porcentaje", { partida: r.descrizione })}
                        value={avance[r.chiave] ?? ""}
                        placeholder={formatNumber(r.percentualePrecedente)}
                        disabled={hecha}
                        onChange={(e) => setAvance({ ...avance, [r.chiave]: e.target.value })}
                        className="pr-7 text-right"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={hecha}
                      onClick={() => setAvance({ ...avance, [r.chiave]: "100" })}
                    >
                      100%
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sal-fecha">{t("sal.fecha")}</Label>
              <Input id="sal-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sal-nota">{t("sal.nota")}</Label>
              <Textarea id="sal-nota" rows={1} value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>
          </div>

          {calculo && (
            <dl className="rounded-lg bg-secondary/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("sal.importeEste")}</dt>
                <dd className="font-medium text-foreground whitespace-nowrap">{formatCurrency(Math.max(0, calculo.importo))}</dd>
              </div>
              {calculo.recuperoAcconto > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("sal.recuperoEste")}</dt>
                  <dd className="text-foreground whitespace-nowrap">- {formatCurrency(calculo.recuperoAcconto)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-border pt-1">
                <dt className="text-foreground font-medium">{t("sal.aFacturar")}</dt>
                <dd className="font-semibold text-foreground whitespace-nowrap">{formatCurrency(Math.max(0, calculo.daFatturare))}</dd>
              </div>
              {calculo.finale && <p className="text-xs text-muted-foreground">{t("sal.esFinal")}</p>}
              {(calculo.errori.retrocede.length > 0 || calculo.errori.fuoriRango.length > 0) && (
                <p className="text-xs text-status-error-fg">{t("sal.avisoRango")}</p>
              )}
            </dl>
          )}

          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <DialogFooter>
            <Button
              onClick={() => void certificar()}
              disabled={guardando || !calculo || calculo.importo <= 0 || calculo.errori.retrocede.length > 0 || calculo.errori.fuoriRango.length > 0}
            >
              {guardando ? <Spinner className="size-4" /> : t("sal.certificar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
