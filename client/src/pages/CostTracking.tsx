import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { SelectProjectPrompt } from "@/components/SelectProjectPrompt";
import { formatCurrency } from "@/lib/mockData";
import { useApi } from "@/lib/api";
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

export default function CostTracking() {
  const { t } = useTranslation();
  const { selectedProjectId, selectedProject } = useSelectedProject();
  const { data, loading, error } = useApi<ProjectCostTracking[]>("/api/cost-tracking");

  const project = (data ?? []).find((p) => p.projectId === selectedProjectId);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={t("costTracking.title")}
        description={
          selectedProject
            ? `Presupuestado vs. gastado real — ${selectedProject.name}`
            : "Presupuestado vs. gastado real, por proyecto"
        }
      />

      {!selectedProjectId && <SelectProjectPrompt />}

      {selectedProjectId && loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Cargando costos...
        </div>
      )}

      {selectedProjectId && error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          No se pudo cargar desde Supabase: {error}
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
            Este proyecto todavía no tiene gastos ni presupuesto vinculado.
          </p>
        )
      )}
    </div>
  );
}
