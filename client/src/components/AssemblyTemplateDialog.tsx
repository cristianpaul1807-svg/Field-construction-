import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Trash2 } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/mockData";
import { useTranslation } from "react-i18next";

interface CatalogResponse {
  materials: { id: string; name: string; unit: string; price: number | null }[];
  laborRates: { id: string; name: string; hourlyRate: number }[];
  subcontractors: { id: string; name: string; trade: string | null }[];
}

interface TemplateDetail {
  id: string;
  name: string;
  description: string | null;
  items: {
    id: string;
    materialId: string | null;
    laborRateId: string | null;
    subcontractorId: string | null;
    quantity: number;
  }[];
}

// A row references exactly one catalog entry. Encoding the kind into the
// select value ("material:<id>") keeps that a single choice in the UI instead
// of three fields where two must be left empty.
interface Row {
  key: string;
  ref: string;
  quantity: string;
}

let rowSeq = 0;
const newRow = (): Row => ({ key: `row-${rowSeq++}`, ref: "", quantity: "1" });

export function AssemblyTemplateDialog({
  templateId,
  open,
  onOpenChange,
  onSaved,
}: {
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { data: catalog } = useApi<CatalogResponse>(open ? "/api/materials" : null);
  const { data: detail, loading: detailLoading } = useApi<TemplateDetail>(
    open && templateId ? `/api/assembly-templates/${templateId}` : null
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!templateId) {
      setName("");
      setDescription("");
      setRows([newRow()]);
      setError(null);
      return;
    }
    if (!detail) return;
    setName(detail.name);
    setDescription(detail.description ?? "");
    setRows(
      detail.items.length > 0
        ? detail.items.map((i) => ({
            key: i.id,
            ref: i.materialId
              ? `material:${i.materialId}`
              : i.laborRateId
                ? `labor:${i.laborRateId}`
                : i.subcontractorId
                  ? `sub:${i.subcontractorId}`
                  : "",
            quantity: String(i.quantity),
          }))
        : [newRow()]
    );
    setError(null);
  }, [open, templateId, detail]);

  const unitPriceFor = (ref: string): number | null => {
    const [kind, id] = ref.split(":");
    if (kind === "material") return catalog?.materials.find((m) => m.id === id)?.price ?? null;
    if (kind === "labor") return catalog?.laborRates.find((l) => l.id === id)?.hourlyRate ?? null;
    return null;
  };

  const estimatedCost = rows.reduce((sum, r) => {
    const price = unitPriceFor(r.ref);
    return price === null ? sum : sum + price * (Number(r.quantity) || 0);
  }, 0);

  const save = async () => {
    if (!name.trim()) {
      setError(t("budgets.templateNameRequired"));
      return;
    }
    const items = rows
      .filter((r) => r.ref && Number(r.quantity) > 0)
      .map((r) => {
        const [kind, id] = r.ref.split(":");
        return {
          materialId: kind === "material" ? id : null,
          laborRateId: kind === "labor" ? id : null,
          subcontractorId: kind === "sub" ? id : null,
          quantity: Number(r.quantity),
        };
      });

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(
        templateId ? `/api/assembly-templates/${templateId}` : "/api/assembly-templates",
        {
          method: templateId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, items }),
        }
      );
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || t("common.genericError"));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{templateId ? t("budgets.editTemplate") : t("budgets.newTemplate")}</DialogTitle>
          <DialogDescription>{t("budgets.templateHint")}</DialogDescription>
        </DialogHeader>

        {detailLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Spinner className="size-4" /> {t("common.loading")}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">{t("common.name")}</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("budgets.templateNamePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-description">{t("common.description")}</Label>
              <Textarea
                id="template-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("budgets.templateDescriptionPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("budgets.templateItems")}</Label>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRows((r) => [...r, newRow()])}>
                  <Plus size={13} strokeWidth={1.75} /> {t("budgets.addLine")}
                </Button>
              </div>

              {rows.map((row, idx) => (
                <div key={row.key} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Select
                      value={row.ref || undefined}
                      onValueChange={(v) =>
                        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ref: v } : r)))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("budgets.selectCatalogItem")} />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalog?.materials ?? []).map((m) => (
                          <SelectItem key={`material:${m.id}`} value={`material:${m.id}`}>
                            {m.name} · {t("materials.categoryMaterials")}
                          </SelectItem>
                        ))}
                        {(catalog?.laborRates ?? []).map((l) => (
                          <SelectItem key={`labor:${l.id}`} value={`labor:${l.id}`}>
                            {l.name} · {t("materials.categoryLabor")}
                          </SelectItem>
                        ))}
                        {(catalog?.subcontractors ?? []).map((sub) => (
                          <SelectItem key={`sub:${sub.id}`} value={`sub:${sub.id}`}>
                            {sub.name} · {t("materials.categorySubcontractors")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    className="w-24"
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.quantity}
                    onChange={(e) =>
                      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r)))
                    }
                    aria-label={t("budgets.quantity")}
                  />
                  <button
                    aria-label={t("common.delete")}
                    className="p-2 rounded-md text-muted-foreground hover:text-status-error-fg hover:bg-secondary transition-colors"
                    onClick={() => setRows((prev) => (prev.length === 1 ? [newRow()] : prev.filter((_, i) => i !== idx)))}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              ))}

              {estimatedCost > 0 && (
                <p className="text-xs text-muted-foreground text-right">
                  {t("budgets.templateEstimatedCost", { amount: formatCurrency(estimatedCost) })}
                </p>
              )}
            </div>

            {error && <p className="text-sm text-status-error-fg">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
