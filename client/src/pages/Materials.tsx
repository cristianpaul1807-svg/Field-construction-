import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, HardHat } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useApi, apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface MaterialRow {
  id: string;
  name: string;
  unit: string;
  price: number | null;
  category: string | null;
  supplier: string | null;
  isReferenceOnly: boolean;
}

interface LaborRow {
  id: string;
  name: string;
  hourlyRate: number;
}

interface MaterialsResponse {
  materials: MaterialRow[];
  laborRates: LaborRow[];
  subcontractors: { id: string; name: string; trade: string | null; rating: number | null }[];
}

type MaterialDraft = { id: string | null; name: string; unit: string; price: string; category: string; supplier: string };
type LaborDraft = { id: string | null; name: string; hourlyRate: string };

const EMPTY_MATERIAL: MaterialDraft = { id: null, name: "", unit: "", price: "", category: "", supplier: "" };
const EMPTY_LABOR: LaborDraft = { id: null, name: "", hourlyRate: "" };

export default function Materials() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useApi<MaterialsResponse>("/api/materials");
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState<MaterialDraft | null>(null);
  const [labor, setLabor] = useState<LaborDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Materials, labor rates and subcontractors are three tables but one
  // mental object for the contractor pricing a job, so they share a table.
  // The `kind` tag is what lets a row know which endpoint edits it.
  const rows = useMemo(() => {
    if (!data) return [];
    const materialRows = data.materials.map((m) => ({
      kind: "material" as const,
      id: m.id,
      key: `material-${m.id}`,
      name: m.name,
      category: m.category ?? t("materials.categoryMaterials"),
      unit: m.unit,
      supplier: m.supplier ?? "—",
      price: m.isReferenceOnly ? null : m.price,
      source: m,
    }));
    const laborRows = data.laborRates.map((l) => ({
      kind: "labor" as const,
      id: l.id,
      key: `labor-${l.id}`,
      name: l.name,
      category: t("materials.categoryLabor"),
      unit: t("materials.hour"),
      supplier: "—",
      price: l.hourlyRate,
      source: l,
    }));
    const subRows = data.subcontractors.map((s) => ({
      kind: "sub" as const,
      id: s.id,
      key: `sub-${s.id}`,
      name: s.name,
      category: t("materials.categorySubcontractors"),
      unit: t("materials.service"),
      supplier: s.trade ?? "—",
      price: null as number | null,
      source: s,
    }));
    return [...materialRows, ...laborRows, ...subRows].filter((r) =>
      r.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [data, query, t]);

  const saveMaterial = async () => {
    if (!material) return;
    if (!material.name.trim() || !material.unit.trim()) {
      setFormError(t("materials.nameUnitRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await apiFetch(material.id ? `/api/materials/${material.id}` : "/api/materials", {
        method: material.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: material.name,
          unit: material.unit,
          price: material.price,
          category: material.category,
          supplier: material.supplier,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || t("common.genericError"));
      setMaterial(null);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setSaving(false);
    }
  };

  const saveLabor = async () => {
    if (!labor) return;
    if (!labor.name.trim() || labor.hourlyRate === "") {
      setFormError(t("materials.nameRateRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await apiFetch(labor.id ? `/api/labor-rates/${labor.id}` : "/api/labor-rates", {
        method: labor.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: labor.name, hourlyRate: labor.hourlyRate }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || t("common.genericError"));
      setLabor(null);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (kind: "material" | "labor", id: string) => {
    if (!window.confirm(t("materials.deleteConfirm"))) return;
    const path = kind === "material" ? `/api/materials/${id}` : `/api/labor-rates/${id}`;
    const res = await apiFetch(path, { method: "DELETE" });
    if (res.ok) reload();
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={t("materials.title")}
        description={t("materials.description")}
        action={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setFormError(null);
                setLabor({ ...EMPTY_LABOR });
              }}
            >
              <HardHat size={16} strokeWidth={1.75} /> {t("materials.newLaborRate")}
            </Button>
            <Button
              className="gap-2"
              onClick={() => {
                setFormError(null);
                setMaterial({ ...EMPTY_MATERIAL });
              }}
            >
              <Plus size={16} strokeWidth={1.75} /> {t("materials.newMaterial")}
            </Button>
          </div>
        }
      />

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search size={16} className="text-muted-foreground" />
          <Input
            placeholder={t("materials.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Spinner className="size-4" /> {t("common.loading")}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
            {t("common.loadError", { message: error })}
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("common.name")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("common.category")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("materials.unit")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("materials.supplier")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t("materials.price")}</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-border last:border-0 hover:bg-secondary transition-colors">
                    <td className="py-3 text-foreground font-medium">{row.name}</td>
                    <td className="py-3 text-muted-foreground">{row.category}</td>
                    <td className="py-3 text-muted-foreground">{row.unit}</td>
                    <td className="py-3 text-muted-foreground">{row.supplier}</td>
                    <td className="py-3 text-right">
                      {row.price === null ? (
                        <StatusBadge tone="neutral">
                          {row.kind === "sub" ? t("materials.quotedPerProject") : t("materials.referenceOnly")}
                        </StatusBadge>
                      ) : (
                        <span className="text-foreground">{formatCurrency(row.price)}</span>
                      )}
                    </td>
                    <td className="py-3">
                      {row.kind !== "sub" && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            aria-label={t("common.edit")}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                            onClick={() => {
                              setFormError(null);
                              if (row.kind === "material") {
                                const m = row.source as MaterialRow;
                                setMaterial({
                                  id: m.id,
                                  name: m.name,
                                  unit: m.unit,
                                  price: m.price === null ? "" : String(m.price),
                                  category: m.category ?? "",
                                  supplier: m.supplier ?? "",
                                });
                              } else {
                                const l = row.source as LaborRow;
                                setLabor({ id: l.id, name: l.name, hourlyRate: String(l.hourlyRate) });
                              }
                            }}
                          >
                            <Pencil size={14} strokeWidth={1.75} />
                          </button>
                          <button
                            aria-label={t("common.delete")}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-status-error-fg hover:bg-card transition-colors"
                            onClick={() => remove(row.kind, row.id)}
                          >
                            <Trash2 size={14} strokeWidth={1.75} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {t("materials.noResults")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={material !== null} onOpenChange={(open) => !open && setMaterial(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{material?.id ? t("materials.editMaterial") : t("materials.newMaterial")}</DialogTitle>
            <DialogDescription>{t("materials.materialDialogHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="material-name">{t("common.name")}</Label>
              <Input
                id="material-name"
                value={material?.name ?? ""}
                onChange={(e) => setMaterial((m) => (m ? { ...m, name: e.target.value } : m))}
                placeholder={t("materials.namePlaceholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="material-unit">{t("materials.unit")}</Label>
                <Input
                  id="material-unit"
                  value={material?.unit ?? ""}
                  onChange={(e) => setMaterial((m) => (m ? { ...m, unit: e.target.value } : m))}
                  placeholder={t("materials.unitPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="material-price">{t("materials.price")}</Label>
                <Input
                  id="material-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={material?.price ?? ""}
                  onChange={(e) => setMaterial((m) => (m ? { ...m, price: e.target.value } : m))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="material-category">{t("common.category")}</Label>
                <Input
                  id="material-category"
                  value={material?.category ?? ""}
                  onChange={(e) => setMaterial((m) => (m ? { ...m, category: e.target.value } : m))}
                  placeholder={t("materials.categoryPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="material-supplier">{t("materials.supplier")}</Label>
                <Input
                  id="material-supplier"
                  value={material?.supplier ?? ""}
                  onChange={(e) => setMaterial((m) => (m ? { ...m, supplier: e.target.value } : m))}
                  placeholder={t("materials.supplierPlaceholder")}
                />
              </div>
            </div>
            {formError && <p className="text-sm text-status-error-fg">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterial(null)}>{t("common.cancel")}</Button>
            <Button onClick={saveMaterial} disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={labor !== null} onOpenChange={(open) => !open && setLabor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{labor?.id ? t("materials.editLaborRate") : t("materials.newLaborRate")}</DialogTitle>
            <DialogDescription>{t("materials.laborDialogHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="labor-name">{t("common.name")}</Label>
              <Input
                id="labor-name"
                value={labor?.name ?? ""}
                onChange={(e) => setLabor((l) => (l ? { ...l, name: e.target.value } : l))}
                placeholder={t("materials.laborNamePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="labor-rate">{t("materials.hourlyRate")}</Label>
              <Input
                id="labor-rate"
                type="number"
                min={0}
                step="0.01"
                value={labor?.hourlyRate ?? ""}
                onChange={(e) => setLabor((l) => (l ? { ...l, hourlyRate: e.target.value } : l))}
                placeholder="0.00"
              />
            </div>
            {formError && <p className="text-sm text-status-error-fg">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabor(null)}>{t("common.cancel")}</Button>
            <Button onClick={saveLabor} disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
