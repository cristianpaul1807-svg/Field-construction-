import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/mockData";

export interface DatosDelBonifico {
  bonus: string;
  causale: string | null;
  ritenuta: number;
  faltaCodiceFiscale: boolean;
}

/**
 * Cómo pagar una factura de una obra con bonus sin perder la deducción.
 *
 * El texto va en italiano —lo lee el banco— y entero, para copiarlo y pegarlo
 * en la causal de la transferencia. Un bonifico normal, o uno con la ley mal
 * citada, le hace perder al cliente el 50 % o el 36 % de lo que paga.
 *
 * Lo usan el portal del cliente (para pagar) y el panel (para saber qué le
 * llega: el banco retiene el 11 % a la impresa).
 */
export function BonificoParlante({ datos, negocio, vista }: { datos: DatosDelBonifico; negocio?: string; vista: "cliente" | "negocio" }) {
  const { t } = useTranslation();
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    if (!datos.causale) return;
    try {
      await navigator.clipboard.writeText(datos.causale);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin portapapeles el texto sigue ahí para seleccionarlo a mano.
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2 text-left">
      <p className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
        <Landmark size={14} className="shrink-0" />
        {t(vista === "cliente" ? "bonus.payTitle" : "bonus.panelTitle", { kind: t(`bonus.kind.${datos.bonus}`) })}
      </p>
      {datos.causale ? (
        <>
          <p className="text-xs text-muted-foreground">{t(vista === "cliente" ? "bonus.payHint" : "bonus.panelHint")}</p>
          <p className="text-xs font-mono text-foreground bg-secondary/60 rounded-md p-2 break-words select-all">{datos.causale}</p>
          <Button size="sm" variant="outline" className="gap-1.5 min-h-11 sm:min-h-0" onClick={() => void copiar()}>
            {copiado ? <Check size={13} /> : <Copy size={13} />}
            {copiado ? t("bonus.copied") : t("bonus.copy")}
          </Button>
        </>
      ) : (
        <p className="text-xs text-status-warning-fg">
          {t(vista === "cliente" ? "bonus.missingCfClient" : "bonus.missingCfPanel", { business: negocio ?? "", messages: t("clientPortal.messages") })}
        </p>
      )}
      {vista === "negocio" && <p className="text-xs text-muted-foreground">{t("bonus.withholding", { amount: formatCurrency(datos.ritenuta) })}</p>}
    </div>
  );
}
