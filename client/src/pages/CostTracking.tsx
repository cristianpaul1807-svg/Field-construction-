import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { SelectProjectPrompt } from "@/components/SelectProjectPrompt";
import { formatCurrency } from "@/lib/mockData";
import { useApi, apiFetch } from "@/lib/api";
import { useSelectedProject } from "@/contexts/SelectedProjectContext";
import { useTranslation } from "react-i18next";

interface CostRow {
  category: string;
  budgeted: number;
  actual: number;
}

interface ProjectCostTracking {
  projectId: string;
  projectName: string;
  rows: CostRow[];
}

interface Expense {
  id: string;
  projectId: string;
  projectName: string | null;
  category: string | null;
  description: string | null;
  amount: number;
  date: string;
}

// Matching the categories the budget is broken into is what makes the
// budgeted-vs-actual comparison line up instead of landing in a stray row.
const CATEGORIES = ["materiales", "mano_obra", "subcontratistas", "equipos", "permisos", "otros"] as const;

export default function CostTracking() {
  const { t, i18n } = useTranslation();
  const { selectedProjectId, selectedProject } = useSelectedProject();
  const { data, loading, error, reload } = useApi<ProjectCostTracking[]>("/api/cost-tracking");
  const {
    data: expenses,
    loading: expensesLoading,
    reload: reloadExpenses,
  } = useApi<Expense[]>(selectedProjectId ? `/api/expenses?projectId=${selectedProjectId}` : null);

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("materiales");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const project = (data ?? []).find((p) => p.projectId === selectedProjectId);

  const save = async () => {
    if (!amount || Number(amount) <= 0) {
      setFormError(t("costTracking.amountRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await apiFetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, category, description, amount, date }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || t("common.genericError"));
      setOpen(false);
      setDescription("");
      setAmount("");
      reload();
      reloadExpenses();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("costTracking.deleteConfirm"))) return;
    const res = await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) {
      reload();
      reloadExpenses();
    }
  };

  const categoryLabel = (value: string | null) =>
    value && (CATEGORIES as readonly string[]).includes(value) ? t(`costTracking.categories.${value}`) : value || "—";

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={t("costTracking.title")}
        description={
          selectedProject
            ? t("costTracking.descriptionForProject", { project: selectedProject.name })
            : t("costTracking.description")
        }
        action={
          selectedProjectId ? (
            <Button className="gap-2" onClick={() => { setFormError(null); setOpen(true); }}>
              <Plus size={16} strokeWidth={1.75} /> {t("costTracking.recordExpense")}
            </Button>
          ) : undefined
        }
      />

      {!selectedProjectId && <SelectProjectPrompt />}

      {selectedProjectId && loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}

      {selectedProjectId && error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          {t("common.loadError", { message: error })}
        </div>
      )}

      {selectedProjectId && !loading && !error && (
        project ? (
          <Card className="p-6 overflow-x-auto">
            <h2 className="text-base font-semibold text-foreground mb-4">{project.projectName}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("costTracking.item")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t("costTracking.budgeted")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t("costTracking.actual")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t("costTracking.deviation")}</th>
                </tr>
              </thead>
              <tbody>
                {project.rows.map((row) => {
                  const variance = row.budgeted > 0 ? ((row.actual - row.budgeted) / row.budgeted) * 100 : null;
                  return (
                    <tr key={row.category} className="border-b border-border hover:bg-secondary transition-colors">
                      <td className="py-3 text-foreground font-medium">{row.category}</td>
                      <td className="py-3 text-right text-foreground">{formatCurrency(row.budgeted)}</td>
                      <td className="py-3 text-right text-foreground">{formatCurrency(row.actual)}</td>
                      <td className={`py-3 text-right font-medium ${variance === null ? "text-muted-foreground" : variance > 0 ? "text-status-error-fg" : "text-status-success-fg"}`}>
                        {variance === null ? "—" : `${variance > 0 ? "+" : ""}${variance.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
                {(() => {
                  const totalBudgeted = project.rows.reduce((s, r) => s + r.budgeted, 0);
                  const totalActual = project.rows.reduce((s, r) => s + r.actual, 0);
                  const totalVariance = totalBudgeted > 0 ? ((totalActual - totalBudgeted) / totalBudgeted) * 100 : null;
                  return (
                    <tr className="bg-secondary font-semibold">
                      <td className="py-3 text-foreground">{t("costTracking.total")}</td>
                      <td className="py-3 text-right text-foreground">{formatCurrency(totalBudgeted)}</td>
                      <td className="py-3 text-right text-foreground">{formatCurrency(totalActual)}</td>
                      <td className={`py-3 text-right ${totalVariance === null ? "text-muted-foreground" : totalVariance > 0 ? "text-status-error-fg" : "text-status-success-fg"}`}>
                        {totalVariance === null ? "—" : `${totalVariance > 0 ? "+" : ""}${totalVariance.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {t("costTracking.noBudgetLinked")}
          </p>
        )
      )}

      {selectedProjectId && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">{t("costTracking.expensesTitle")}</h2>
          {expensesLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Spinner className="size-4" /> {t("common.loading")}
            </div>
          )}
          {!expensesLoading && (expenses ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("costTracking.noExpenses")}</p>
          )}
          {!expensesLoading && (expenses ?? []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">{t("common.date")}</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">{t("common.category")}</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">{t("common.description")}</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">{t("common.amount")}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {(expenses ?? []).map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0 hover:bg-secondary transition-colors">
                      <td className="py-3 text-muted-foreground">
                        {new Date(`${e.date}T00:00:00`).toLocaleDateString(i18n.language)}
                      </td>
                      <td className="py-3 text-foreground">{categoryLabel(e.category)}</td>
                      <td className="py-3 text-muted-foreground">{e.description || "—"}</td>
                      <td className="py-3 text-right text-foreground font-medium">{formatCurrency(e.amount)}</td>
                      <td className="py-3 text-right">
                        <button
                          aria-label={t("common.delete")}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-status-error-fg hover:bg-card transition-colors"
                          onClick={() => remove(e.id)}
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("costTracking.recordExpense")}</DialogTitle>
            <DialogDescription>{t("costTracking.recordExpenseHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("common.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{t(`costTracking.categories.${c}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="expense-amount">{t("common.amount")}</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expense-date">{t("common.date")}</Label>
                <Input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-description">{t("common.description")}</Label>
              <Input
                id="expense-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("costTracking.descriptionPlaceholder")}
              />
            </div>
            {formError && <p className="text-sm text-status-error-fg">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
