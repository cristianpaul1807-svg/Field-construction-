import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, FileMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useApi, downloadFile } from "@/lib/api";
import { formatCurrency } from "@/lib/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { paisDe } from "@shared/paises";
import { BotonFatturaPA } from "@/components/BotonFatturaPA";

interface Nota {
  id: string;
  number: string;
  reason: string | null;
  amount: number;
  createdAt: string;
}

/**
 * Las notas de crédito de una factura, con su papel.
 *
 * Una nota se emitía y no había dónde descargarla: la ruta del PDF existía y
 * ningún botón la llamaba, así que el contable que pedía «la nota del mes
 * pasado» se quedaba sin ella. En Italia, además, una nota es un documento
 * más que va al SDI (TD04), y necesita su XML igual que la factura.
 */
export function NotasDeLaFactura({ invoiceId }: { invoiceId: string }) {
  const { t, i18n } = useTranslation();
  const { country } = useAuth();
  const { data: notas } = useApi<Nota[]>(`/api/credit-notes?invoiceId=${invoiceId}`);
  const [bajando, setBajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pdf = async (n: Nota) => {
    setBajando(n.id);
    setError(null);
    try {
      await downloadFile(`/api/credit-notes/${n.id}/pdf?download=1&lang=${i18n.language.slice(0, 2)}`, `${n.number}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setBajando(null);
    }
  };

  if (!notas || notas.length === 0) return null;
  return (
    <div className="space-y-1.5 pt-1">
      {notas.map((n) => (
        <div key={n.id} className="flex flex-wrap items-center gap-2 text-xs">
          <FileMinus size={13} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
          <span className="font-mono text-foreground">{n.number}</span>
          <span className="text-muted-foreground">−{formatCurrency(n.amount)}</span>
          <Button size="sm" variant="ghost" className="gap-1 h-7 px-2" onClick={() => void pdf(n)} disabled={bajando === n.id}>
            {bajando === n.id ? <Spinner className="size-3" /> : <Download size={12} />} PDF
          </Button>
          {paisDe(country).impuestos === "italia" && <BotonFatturaPA ruta={`/api/credit-notes/${n.id}/fatturapa`} />}
        </div>
      ))}
      {error && <p className="text-xs text-status-error-fg">{error}</p>}
    </div>
  );
}
