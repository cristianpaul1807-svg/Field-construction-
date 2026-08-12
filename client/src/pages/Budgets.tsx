import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Trash2, Check, Download } from "lucide-react";
import { AssemblyTemplateDialog } from "@/components/AssemblyTemplateDialog";
import { formatCurrency } from "@/lib/mockData";
import { useApi, apiFetch, downloadFile } from "@/lib/api";
import { WorkProjectionPanel } from "@/components/WorkProjectionPanel";
import { BudgetCategoriesPanel } from "@/components/BudgetCategoriesPanel";
import { NewEstimateDialog } from "@/components/NewEstimateDialog";
import { useTranslation } from "react-i18next";

interface EstimateSummary {
  id: string;
  clientName: string | null;
  status: string;
  createdBy: "bot" | "human";
  categoryName: string | null;
  description: string | null;
  total: number;
  createdAt: string;
}

interface BudgetCategory {
  id: string;
  name: string;
}

interface EstimateLine {
  id: string;
  zone: string;
  category: "Materiales" | "Mano de obra" | "Subcontratistas";
  item: string;
  quantity: number;
  unitCost: number;
  visibleToClient: boolean;
}

interface EstimateDetail {
  id: string;
  clientName: string | null;
  clientAddress: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  status: string;
  createdBy: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  marginType: "global" | "section";
  marginPercent: number;
  wastePercent: number;
  createdAt: string;
  lines: EstimateLine[];
}

interface AssemblyTemplate {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  laborHours: number;
}

function ErrorNote({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
      {t("common.loadError", { message })}
    </div>
  );
}

const emptyLineForm: { zone: string; category: EstimateLine["category"]; item: string; quantity: number; unitCost: number } = {
  zone: "",
  category: "Materiales",
  item: "",
  quantity: 1,
  unitCost: 0,
};

export default function Budgets() {
  const { t, i18n } = useTranslation();
  const [reloadToken, setReloadToken] = useState(0);
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);
  const [newBudgetOpen, setNewBudgetOpen] = useState(false);
  const { data: summaries, loading: summariesLoading, error: summariesError } =
    useApi<EstimateSummary[]>(`/api/estimates?_r=${reloadToken}`);
  const draftId = activeEstimateId ?? (summaries && summaries.length > 0 ? summaries[0].id : null);
  const { data: draft, loading: draftLoading, error: draftError } =
    useApi<EstimateDetail>(draftId ? `/api/estimates/${draftId}?_r=${reloadToken}` : null);
  const { data: assemblyTemplates, loading: templatesLoading, error: templatesError } =
    useApi<AssemblyTemplate[]>("/api/assembly-templates");
  const { data: categories } = useApi<BudgetCategory[]>(`/api/budget-categories?_r=${reloadToken}`);

  const refresh = () => setReloadToken((t) => t + 1);

  // The document is rendered server-side so the customer's copy carries the
  // business's own letterhead, licence and GST/QST numbers — none of which
  // the browser has — and comes out in whatever language the panel is in.
  const downloadEstimate = async () => {
    if (!draftId) return;
    setDownloading(true);
    setPdfError(null);
    try {
      await downloadFile(
        `/api/estimates/${draftId}/pdf?download=1&lang=${i18n.language.slice(0, 2)}`,
        `${t("budgets.estimateFilePrefix")}-${draftId.slice(0, 8).toUpperCase()}.pdf`
      );
      setPdfOpen(false);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setDownloading(false);
    }
  };

  const setCategory = async (categoryId: string) => {
    if (!draftId) return;
    await apiFetch(`/api/estimates/${draftId}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
    refresh();
  };

  const [marginType, setMarginType] = useState<"global" | "section">("global");
  const [marginPercent, setMarginPercent] = useState(0);
  const [wastePercent, setWastePercent] = useState(0);
  const [visibility, setVisibility] = useState<boolean[]>([]);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [lineEdits, setLineEdits] = useState<Record<string, { item: string; quantity: number; unitCost: number }>>({});
  const [lineForm, setLineForm] = useState(emptyLineForm);
  const [addingLine, setAddingLine] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [templateZonePrompt, setTemplateZonePrompt] = useState<{ id: string; name: string } | null>(null);
  const [templateEditor, setTemplateEditor] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [templateZone, setTemplateZone] = useState("");
  const [insertingTemplate, setInsertingTemplate] = useState(false);

  // Sync locally-editable state whenever a new draft loads.
  useEffect(() => {
    if (!draft) return;
    setMarginType(draft.marginType);
    setMarginPercent(draft.marginPercent);
    setWastePercent(draft.wastePercent);
    setVisibility(draft.lines.map((l) => l.visibleToClient));
    setLineEdits(
      Object.fromEntries(draft.lines.map((l) => [l.id, { item: l.item, quantity: l.quantity, unitCost: l.unitCost }]))
    );
  }, [draft]);

  const loading = summariesLoading || draftLoading;
  const error = summariesError || draftError;

  const lines = draft?.lines ?? [];
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
  const wasteAmount = subtotal * (wastePercent / 100);
  const marginAmount = (subtotal + wasteAmount) * (marginPercent / 100);
  const total = subtotal + wasteAmount + marginAmount;
  const zones = Array.from(new Set(lines.map((l) => l.zone)));

  const saveLineEdit = async (lineId: string) => {
    const edit = lineEdits[lineId];
    if (!edit) return;
    await apiFetch(`/api/estimates/${draftId}/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemName: edit.item, quantity: edit.quantity, unitCost: edit.unitCost }),
    });
    refresh();
  };

  const toggleLineVisibility = async (lineId: string, idx: number, checked: boolean) => {
    setVisibility((prev) => prev.map((v, i) => (i === idx ? checked : v)));
    await apiFetch(`/api/estimates/${draftId}/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibleToClient: checked }),
    });
  };

  const removeLine = async (lineId: string) => {
    if (!draftId) return;
    await apiFetch(`/api/estimates/${draftId}/lines/${lineId}`, { method: "DELETE" });
    refresh();
  };

  const addLine = async () => {
    if (!draftId || !lineForm.zone.trim() || !lineForm.item.trim()) return;
    setAddingLine(true);
    try {
      await apiFetch(`/api/estimates/${draftId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone: lineForm.zone.trim(),
          category: lineForm.category,
          itemName: lineForm.item.trim(),
          quantity: lineForm.quantity,
          unitCost: lineForm.unitCost,
        }),
      });
      setLineForm(emptyLineForm);
      refresh();
    } finally {
      setAddingLine(false);
    }
  };

  const saveDraft = async () => {
    if (!draftId) return;
    setSavingDraft(true);
    try {
      await apiFetch(`/api/estimates/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marginType, marginPercent, wastePercent }),
      });
      refresh();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } finally {
      setSavingDraft(false);
    }
  };

  const insertTemplate = async () => {
    if (!draftId || !templateZonePrompt || !templateZone.trim()) return;
    setInsertingTemplate(true);
    try {
      await apiFetch(`/api/estimates/${draftId}/lines/from-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: templateZonePrompt.id, zone: templateZone.trim() }),
      });
      setTemplateZonePrompt(null);
      setTemplateZone("");
      refresh();
    } finally {
      setInsertingTemplate(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={t("budgets.title")}
        description={t("budgets.description")}
        action={
          <Button className="gap-2 w-full sm:w-auto" onClick={() => setNewBudgetOpen(true)}>
            <Plus size={16} /> {t("budgets.newBudget")}
          </Button>
        }
      />

      <NewEstimateDialog
        open={newBudgetOpen}
        onOpenChange={setNewBudgetOpen}
        onCreated={(id) => {
          setActiveEstimateId(id);
          refresh();
        }}
      />

      {!summariesLoading && !summariesError && (summaries?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{t("budgets.requestsAndBudgets")}</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {[...(summaries ?? [])]
              .sort((a, b) => {
                const aPending = a.createdBy === "bot" && a.status === "pendiente_aprobacion" ? 0 : 1;
                const bPending = b.createdBy === "bot" && b.status === "pendiente_aprobacion" ? 0 : 1;
                return aPending - bPending;
              })
              .map((summary) => {
                const isNewFromChat = summary.createdBy === "bot" && summary.status === "pendiente_aprobacion";
                const isActive = (activeEstimateId ?? summaries?.[0]?.id) === summary.id;
                return (
                  <button
                    key={summary.id}
                    onClick={() => setActiveEstimateId(summary.id)}
                    className={`text-left flex-shrink-0 w-64 rounded-lg border p-3 transition-colors ${
                      isActive ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-foreground truncate">{summary.clientName ?? t("budgets.noClient")}</p>
                      {isNewFromChat && (
                        <span className="text-[10px] font-semibold text-status-warning-fg bg-status-warning-bg/60 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {t("budgets.newFromChat")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{summary.categoryName ?? t("budgets.noCategory")}</p>
                    {summary.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{summary.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-muted-foreground">
                        {t(`budgets.estimateStatus.${summary.status}`, { defaultValue: summary.status }) ?? summary.status}
                      </span>
                      <span className="text-xs font-medium text-foreground">{formatCurrency(summary.total)}</span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">{t("budgets.tabBuilder")}</TabsTrigger>
          <TabsTrigger value="templates">{t("budgets.templates")}</TabsTrigger>
          <TabsTrigger value="categorias">{t("budgets.tabCategories")}</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="mt-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Spinner className="size-4" /> {t("common.loading")}
            </div>
          )}
          {error && <ErrorNote message={error} />}
          {!loading && !error && !draft && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("budgets.noBudgets")}
            </p>
          )}

          {!loading && !error && draft && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-semibold text-foreground">
                        Presupuesto #{draft.id.slice(0, 8).toUpperCase()}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {draft.clientName}
                        {draft.clientPhone && ` · ${draft.clientPhone}`}
                        {draft.clientEmail && ` · ${draft.clientEmail}`}
                      </p>
                      {draft.createdBy === "bot" && draft.description && (
                        <p className="text-xs text-foreground bg-secondary/60 rounded-md px-2 py-1 mt-1.5 max-w-md">
                          "{draft.description}"
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={draft.categoryId ?? undefined} onValueChange={setCategory}>
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue placeholder={t("budgets.noCategory")} />
                        </SelectTrigger>
                        <SelectContent>
                          {(categories ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <StatusBadge tone="info">{draft.status}</StatusBadge>
                    </div>
                  </div>

                  {zones.map((zone) => (
                    <div key={zone} className="border border-border rounded-lg p-4 mb-4 last:mb-0">
                      <h3 className="font-medium text-foreground mb-3">{t("budgets.zoneLabel", { zone })}</h3>
                      {["Materiales", "Mano de obra", "Subcontratistas"].map((category) => {
                        const zoneLines = lines
                          .map((line, idx) => ({ line, idx }))
                          .filter(({ line }) => line.zone === zone && line.category === category);
                        if (zoneLines.length === 0) return null;
                        return (
                          <div key={category} className="mb-3 pl-4 border-l-2 border-primary/40 last:mb-0">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{t(`budgets.lineCategories.${category}`, { defaultValue: category })}</h4>
                            <div className="space-y-2">
                              {zoneLines.map(({ line, idx }) => {
                                const edit = lineEdits[line.id] ?? { item: line.item, quantity: line.quantity, unitCost: line.unitCost };
                                return (
                                  <div key={line.id} className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={visibility[idx]}
                                      onCheckedChange={(checked) => toggleLineVisibility(line.id, idx, checked === true)}
                                    />
                                    <Input
                                      value={edit.item}
                                      onChange={(e) =>
                                        setLineEdits((prev) => ({ ...prev, [line.id]: { ...edit, item: e.target.value } }))
                                      }
                                      onBlur={() => saveLineEdit(line.id)}
                                      className="h-8 flex-1 min-w-0"
                                    />
                                    <Input
                                      type="number"
                                      value={edit.quantity}
                                      onChange={(e) =>
                                        setLineEdits((prev) => ({ ...prev, [line.id]: { ...edit, quantity: Number(e.target.value) } }))
                                      }
                                      onBlur={() => saveLineEdit(line.id)}
                                      className="h-8 w-20 flex-shrink-0"
                                    />
                                    <Input
                                      type="number"
                                      value={edit.unitCost}
                                      onChange={(e) =>
                                        setLineEdits((prev) => ({ ...prev, [line.id]: { ...edit, unitCost: Number(e.target.value) } }))
                                      }
                                      onBlur={() => saveLineEdit(line.id)}
                                      className="h-8 w-24 flex-shrink-0"
                                    />
                                    <span className="text-foreground flex-shrink-0 w-20 text-right">
                                      {formatCurrency(edit.quantity * edit.unitCost)}
                                    </span>
                                    <button
                                      onClick={() => removeLine(line.id)}
                                      className="text-muted-foreground hover:text-status-error-fg flex-shrink-0"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2 mb-4">
                    {t("budgets.visibilityNote")}
                  </p>

                  <div className="border-t border-border pt-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">{t("budgets.addLine")}</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <Label className="text-xs">{t("budgets.zone")}</Label>
                        <Input
                          value={lineForm.zone}
                          onChange={(e) => setLineForm((f) => ({ ...f, zone: e.target.value }))}
                          placeholder={t("budgets.zoneNamePlaceholder")}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("common.category")}</Label>
                        <Select
                          value={lineForm.category}
                          onValueChange={(v) => setLineForm((f) => ({ ...f, category: v as EstimateLine["category"] }))}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Materiales">{t("budgets.materials")}</SelectItem>
                            <SelectItem value="Mano de obra">{t("budgets.labor")}</SelectItem>
                            <SelectItem value="Subcontratistas">{t("budgets.subcontractors")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <Label className="text-xs">Ítem</Label>
                        <Input
                          value={lineForm.item}
                          onChange={(e) => setLineForm((f) => ({ ...f, item: e.target.value }))}
                          placeholder={t("budgets.itemPlaceholder")}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("budgets.quantity")}</Label>
                        <Input
                          type="number"
                          value={lineForm.quantity}
                          onChange={(e) => setLineForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("budgets.unitCost")}</Label>
                        <Input
                          type="number"
                          value={lineForm.unitCost}
                          onChange={(e) => setLineForm((f) => ({ ...f, unitCost: Number(e.target.value) }))}
                          className="h-8"
                        />
                      </div>
                    </div>
                    <Button size="sm" className="gap-2 mt-3" onClick={addLine} disabled={addingLine}>
                      <Plus size={14} /> {t("budgets.addLine")}
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="p-4">
                  <h3 className="font-semibold text-foreground mb-3 text-sm">{t("budgets.marginAndWaste")}</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">{t("budgets.marginTypeLabel")}</p>
                      <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                        <button
                          onClick={() => setMarginType("global")}
                          className={`flex-1 py-1.5 transition-colors ${marginType === "global" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"}`}
                        >
                          {t("budgets.marginGlobal")}
                        </button>
                        <button
                          onClick={() => setMarginType("section")}
                          className={`flex-1 py-1.5 transition-colors ${marginType === "section" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"}`}
                        >
                          {t("budgets.marginSection")}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Margen</span>
                        <span>{marginPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        value={marginPercent}
                        onChange={(e) => setMarginPercent(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>{t("budgets.waste")}</span>
                        <span>{wastePercent}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={25}
                        value={wastePercent}
                        onChange={(e) => setWastePercent(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Merma ({wastePercent}%)</span>
                    <span className="text-foreground">{formatCurrency(wasteAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Margen ({marginPercent}%)</span>
                    <span className="text-foreground">{formatCurrency(marginAmount)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                    <span className="text-foreground">Total</span>
                    <span className="text-foreground">{formatCurrency(total)}</span>
                  </div>
                </Card>

                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" onClick={() => setPdfOpen(true)}>
                    <FileText size={16} /> {t("budgets.generatePdf")}
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2" onClick={saveDraft} disabled={savingDraft}>
                    {savedFlash ? <Check size={16} /> : null}
                    {savedFlash ? "Guardado" : "Guardar borrador"}
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-3">
                <WorkProjectionPanel
                  estimateId={draft.id}
                  status={draft.status}
                  createdBy={draft.createdBy}
                  clientName={draft.clientName}
                  onChanged={() => setReloadToken((t) => t + 1)}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-foreground">{t("budgets.templates")}</h2>
              <Button size="sm" className="gap-2" onClick={() => setTemplateEditor({ open: true, id: null })}>
                <Plus size={14} /> {t("budgets.newTemplate")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{t("budgets.templateHint")}</p>

            {templatesLoading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Spinner className="size-4" /> {t("common.loading")}
              </div>
            )}
            {templatesError && <ErrorNote message={templatesError} />}

            {!templatesLoading && !templatesError && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {assemblyTemplates?.map((template) => (
                  <Card key={template.id} className="p-4 hover:border-primary/40 transition-colors">
                    <p className="font-medium text-foreground">{template.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("budgets.templateSummary", { items: template.itemCount, hours: template.laborHours })}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={!draftId}
                        onClick={() => setTemplateZonePrompt({ id: template.id, name: template.name })}
                      >
                        {t("budgets.insertIntoEstimate")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTemplateEditor({ open: true, id: template.id })}
                      >
                        {t("common.edit")}
                      </Button>
                    </div>
                  </Card>
                ))}
                {assemblyTemplates?.length === 0 && (
                  <p className="col-span-full text-sm text-muted-foreground text-center py-6">
                    {t("budgets.noTemplates")}
                  </p>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="categorias" className="mt-4">
          <BudgetCategoriesPanel />
        </TabsContent>
      </Tabs>

      {draft && (
        <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{t("budgets.pdfPreview")}</DialogTitle>
              <DialogDescription>
                Presupuesto #{draft.id.slice(0, 8).toUpperCase()} para {draft.clientName}
              </DialogDescription>
            </DialogHeader>
            <div className="border border-border rounded-lg p-6 bg-secondary/40 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">Presupuesto de reforma</p>
                <p className="text-xs text-muted-foreground">{draft.createdAt}</p>
              </div>
              <div className="text-sm text-muted-foreground">
                Cliente: {draft.clientName} · {draft.clientAddress}
              </div>
              <div className="space-y-1 text-sm">
                {lines.filter((_, i) => visibility[i]).map((line) => (
                  <div key={line.id} className="flex justify-between">
                    <span className="text-muted-foreground">{line.item}</span>
                    <span className="text-foreground">{formatCurrency(line.quantity * line.unitCost)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
            {pdfError && <p className="text-sm text-status-error-fg">{pdfError}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPdfOpen(false)}>{t("common.close")}</Button>
              <Button onClick={downloadEstimate} disabled={downloading} className="gap-2">
                <Download size={15} strokeWidth={1.75} />
                {downloading ? t("common.loading") : t("budgets.downloadPdf")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AssemblyTemplateDialog
        templateId={templateEditor.id}
        open={templateEditor.open}
        onOpenChange={(open) => setTemplateEditor((prev) => ({ ...prev, open }))}
        onSaved={refresh}
      />

      <Dialog open={!!templateZonePrompt} onOpenChange={(open) => !open && setTemplateZonePrompt(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("budgets.insertTemplate", { name: templateZonePrompt?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("budgets.templateZoneQuestion")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("budgets.zone")}</Label>
            <Input
              value={templateZone}
              onChange={(e) => setTemplateZone(e.target.value)}
              placeholder={t("budgets.zonePlaceholder")}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateZonePrompt(null)}>{t("common.cancel")}</Button>
            <Button onClick={insertTemplate} disabled={!templateZone.trim() || insertingTemplate}>{t("budgets.insert")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
