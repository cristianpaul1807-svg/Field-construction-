import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Download } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

/**
 * The books, downloadable.
 *
 * Three separate files rather than one, because an accountant maps columns
 * once per file and reuses the mapping every quarter — a single sheet mixing
 * invoices, payments and expenses is one nobody can map at all.
 *
 * The download goes through fetch rather than a plain link because the request
 * needs the session header; a bare <a href> would arrive unauthenticated and
 * hand back a login page named like a spreadsheet.
 */

type Kind = "invoices" | "credit-notes" | "payments" | "expenses" | "quickbooks-customers" | "quickbooks-invoices";

/** El CSV genérico, que el contable mapea una vez y reutiliza cada trimestre. */
const KINDS: Kind[] = ["invoices", "credit-notes", "payments", "expenses"];

/**
 * Los dos que QuickBooks importa sin mapear nada.
 *
 * Van en este orden y separados del resto porque el orden importa: QuickBooks
 * rechaza una factura de un cliente que no conoce, así que los clientes se
 * suben primero. Ponerlos en la misma fila que los otros tres invitaba a
 * bajarse el que tocara y a que fallara la mitad de la importación.
 */
const QUICKBOOKS: Kind[] = ["quickbooks-customers", "quickbooks-invoices"];

function defaultRange() {
  const now = new Date();
  return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0, 10) };
}

export function AccountingExportCard() {
  const { t } = useTranslation();
  const [range, setRange] = useState(defaultRange);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (kind: Kind) => {
    setBusy(kind);
    setError(null);
    try {
      const res = await apiFetch(`/api/reports/accounting-export?kind=${kind}&from=${range.from}&to=${range.to}`);
      if (!res.ok) throw new Error(String(res.status));

      // The filename the server chose, so the file says what it is and which
      // months it covers once it is sitting in somebody's downloads folder.
      const disposition = res.headers.get("content-disposition") ?? "";
      const named = /filename="([^"]+)"/.exec(disposition)?.[1];

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = named ?? `${kind}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("accountingExport.failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("accountingExport.title")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("accountingExport.note")}</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="space-y-1.5 flex-1">
          <Label className="text-xs">{t("payroll.from")}</Label>
          <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        </div>
        <div className="space-y-1.5 flex-1">
          <Label className="text-xs">{t("payroll.to")}</Label>
          <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {KINDS.map((kind) => (
          <Button key={kind} variant="outline" size="sm" className="gap-1.5" disabled={busy !== null} onClick={() => download(kind)}>
            {busy === kind ? <Spinner className="size-3.5" /> : <Download size={14} />}
            {t(`accountingExport.kind.${kind}`)}
          </Button>
        ))}
      </div>

      <div className="pt-3 border-t border-border space-y-2">
        <p className="text-xs font-medium text-foreground">{t("accountingExport.quickbooksTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("accountingExport.quickbooksNote")}</p>
        <div className="flex flex-wrap gap-2">
          {QUICKBOOKS.map((kind, i) => (
            <Button key={kind} variant="outline" size="sm" className="gap-1.5" disabled={busy !== null} onClick={() => download(kind)}>
              {busy === kind ? <Spinner className="size-3.5" /> : <Download size={14} />}
              {i + 1}. {t(`accountingExport.kind.${kind}`)}
            </Button>
          ))}
        </div>
        {/* El código de impuesto tiene que existir con ese nombre en su
            QuickBooks o la importación rechaza las líneas. Decirlo aquí cuesta
            una frase; descubrirlo, una tarde. */}
        <p className="text-xs text-muted-foreground">{t("accountingExport.quickbooksTaxNote")}</p>
      </div>

      {error && <p className="text-sm text-status-error-fg">{error}</p>}
      <p className="text-xs text-muted-foreground">{t("accountingExport.columnsNote")}</p>
    </Card>
  );
}
