import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/mockData";
import { useApi } from "@/lib/api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

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
  const { data, loading, error } = useApi<ProjectCostTracking[]>("/api/cost-tracking");

  const chartData = (data ?? [])
    .filter((p) => p.rows.some((r) => r.budgeted > 0))
    .map((p) => {
      const budgeted = p.rows.reduce((s, r) => s + r.budgeted, 0);
      const actual = p.rows.reduce((s, r) => s + r.actual, 0);
      return { name: p.projectName, presupuestado: budgeted, real: actual };
    });

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Cost Tracking & Profitability"
        description="Presupuestado vs. gastado real, por proyecto"
      />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Cargando costos...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          No se pudo cargar desde Supabase: {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {chartData.length > 0 && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">Presupuestado vs. real por proyecto</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="presupuestado" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} name="Presupuestado" />
                    <Bar dataKey="real" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Real" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {(data ?? []).map((project) => {
            const totalBudgeted = project.rows.reduce((s, r) => s + r.budgeted, 0);
            const totalActual = project.rows.reduce((s, r) => s + r.actual, 0);
            const totalVariance = totalBudgeted > 0 ? ((totalActual - totalBudgeted) / totalBudgeted) * 100 : null;
            return (
              <Card key={project.projectId} className="p-6 overflow-x-auto">
                <h2 className="text-base font-semibold text-foreground mb-4">{project.projectName}</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Ítem</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Presupuestado</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Actual</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Desviación</th>
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
                    <tr className="bg-secondary font-semibold">
                      <td className="py-3 text-foreground">TOTAL</td>
                      <td className="py-3 text-right text-foreground">{formatCurrency(totalBudgeted)}</td>
                      <td className="py-3 text-right text-foreground">{formatCurrency(totalActual)}</td>
                      <td className={`py-3 text-right ${totalVariance === null ? "text-muted-foreground" : totalVariance > 0 ? "text-status-error-fg" : "text-status-success-fg"}`}>
                        {totalVariance === null ? "—" : `${totalVariance > 0 ? "+" : ""}${totalVariance.toFixed(1)}%`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            );
          })}

          {(data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Todavía no hay gastos ni presupuestos vinculados a proyectos.
            </p>
          )}
        </>
      )}
    </div>
  );
}
