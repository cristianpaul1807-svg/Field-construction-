import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HardHat, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiEnviar, useApi } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/mockData";
import { CATEGORIE_CONGRUITA, INDICI_CONGRUITA, SOGLIA_PRIVATI, type Congruita } from "@shared/congruita";

interface Respuesta extends Congruita {
  lavoroPubblico: boolean;
  valoreManuale: number | null;
  valoreContratto: number;
  oreSenzaCosto: number;
}

/**
 * La congruità de la mano de obra, mientras la obra todavía se puede corregir.
 *
 * La Cassa Edile la comprueba al final, antes del saldo; quien se entera
 * entonces de que le falta mano de obra declarada tiene quince días y una
 * diferencia que pagar. Aquí se ve desde el primer día, con las horas que ya
 * están aprobadas, cuánto falta para llegar.
 *
 * Arriba va el veredicto y lo que falta, que es lo único que se mira con prisa;
 * la categoría y el valor quedan debajo porque se escriben una vez.
 */
export function CongruitaDeLaObra({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data, loading, reload } = useApi<Respuesta>(`/api/projects/${projectId}/congruita`);
  const [guardando, setGuardando] = useState(false);
  const [valor, setValor] = useState("");

  useEffect(() => {
    setValor(data?.valoreManuale === null || data?.valoreManuale === undefined ? "" : String(data.valoreManuale));
  }, [data?.valoreManuale]);

  const guardar = async (cambio: Record<string, unknown>) => {
    setGuardando(true);
    try {
      await apiEnviar(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambio),
      });
      reload();
    } catch {
      // apiEnviar ya ha avisado.
    } finally {
      setGuardando(false);
    }
  };

  if (loading && !data) {
    return (
      <Card className="p-4">
        <Spinner className="size-4" />
      </Card>
    );
  }
  if (!data) return null;

  const og = CATEGORIE_CONGRUITA.filter((c) => !c.startsWith("os"));
  const os = CATEGORIE_CONGRUITA.filter((c) => c.startsWith("os"));
  const avance = data.minima > 0 ? Math.min(1, data.manodopera / data.minima) : 0;

  const veredicto = (() => {
    switch (data.estado) {
      case "congrua":
        return { icono: CheckCircle2, color: "text-status-success-fg", texto: t("congruita.estado.congrua") };
      case "tolleranza":
        return { icono: AlertTriangle, color: "text-status-warning-fg", texto: t("congruita.estado.tolleranza", { falta: formatCurrency(data.falta) }) };
      case "non_congrua":
        return { icono: XCircle, color: "text-status-error-fg", texto: t("congruita.estado.non_congrua", { falta: formatCurrency(data.falta) }) };
      case "no_aplica":
        return { icono: CheckCircle2, color: "text-muted-foreground", texto: t("congruita.estado.no_aplica", { soglia: formatCurrency(SOGLIA_PRIVATI) }) };
      case "sin_valor":
        return { icono: AlertTriangle, color: "text-status-warning-fg", texto: t("congruita.estado.sin_valor") };
      default:
        return { icono: AlertTriangle, color: "text-status-warning-fg", texto: t("congruita.estado.sin_categoria") };
    }
  })();
  const Icono = veredicto.icono;
  const conCifras = data.estado === "congrua" || data.estado === "tolleranza" || data.estado === "non_congrua";

  return (
    <Card className="p-4 gap-3">
      <div className="flex items-center gap-2">
        <HardHat size={15} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
        <p className="text-sm font-medium text-foreground">{t("congruita.title")}</p>
        {guardando && <Spinner className="size-3.5 ml-auto" />}
      </div>

      <p className={`text-sm inline-flex items-start gap-1.5 ${veredicto.color}`}>
        <Icono size={14} className="shrink-0 mt-0.5" /> <span className="min-w-0 break-words">{veredicto.texto}</span>
      </p>

      {conCifras && (
        <div className="space-y-1.5">
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className={`h-2 rounded-full ${data.estado === "congrua" ? "bg-status-success-fg" : data.estado === "tolleranza" ? "bg-status-warning-fg" : "bg-status-error-fg"}`}
              style={{ width: `${Math.round(avance * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground break-words">
            {t("congruita.cifras", {
              manodopera: formatCurrency(data.manodopera),
              minima: formatCurrency(data.minima),
              indice: formatPercent(data.indice ?? 0),
            })}
          </p>
        </div>
      )}
      {data.oreSenzaCosto > 0 && (
        <p className="text-xs text-status-warning-fg break-words">{t("congruita.oreSenzaCosto", { ore: formatNumber(data.oreSenzaCosto) })}</p>
      )}

      <div className="space-y-1.5">
        <Label>{t("congruita.categoria")}</Label>
        <Select
          value={data.categoria ?? "ninguna"}
          onValueChange={(v) => void guardar({ congruitaCategoria: v === "ninguna" ? null : v })}
          disabled={guardando}
        >
          <SelectTrigger className="min-w-0 w-full [&>span]:truncate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-w-[calc(100vw-2rem)]">
            <SelectItem value="ninguna">{t("congruita.sinCategoria")}</SelectItem>
            <SelectGroup>
              <SelectLabel>{t("congruita.grupoOG")}</SelectLabel>
              {og.map((c) => (
                <SelectItem key={c} value={c}>{`${t(`congruita.cat.${c}`)} · ${formatPercent(INDICI_CONGRUITA[c])}`}</SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>{t("congruita.grupoOS")}</SelectLabel>
              {os.map((c) => (
                <SelectItem key={c} value={c}>{`${t(`congruita.cat.${c}`)} · ${formatPercent(INDICI_CONGRUITA[c])}`}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`valore-${projectId}`}>{t("congruita.valore")}</Label>
        <Input
          id={`valore-${projectId}`}
          inputMode="decimal"
          value={valor}
          placeholder={formatCurrency(data.valoreContratto)}
          onChange={(e) => setValor(e.target.value)}
          onBlur={() => {
            const limpio = valor.trim().replace(",", ".");
            if (limpio === (data.valoreManuale === null ? "" : String(data.valoreManuale))) return;
            void guardar({ valoreOpera: limpio === "" ? null : limpio });
          }}
          disabled={guardando}
        />
        <p className="text-xs text-muted-foreground">{t("congruita.valoreHint")}</p>
      </div>

      <label className="flex items-center justify-between gap-3 text-sm text-foreground">
        <span>{t("congruita.pubblico")}</span>
        <Switch
          checked={data.lavoroPubblico}
          onCheckedChange={(v) => void guardar({ lavoroPubblico: v })}
          disabled={guardando}
        />
      </label>

      <p className="text-xs text-muted-foreground">{t("congruita.hint")}</p>
    </Card>
  );
}
