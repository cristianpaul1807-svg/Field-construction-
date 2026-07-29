import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { projects, expensesByProject, marginTrend, formatCurrency } from "@/lib/mockData";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function CostTracking() {
  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Cost Tracking & Profitability"
        description="Presupuestado vs. gastado real, por proyecto"
      />

      <Card className="p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Margen real vs. margen proyectado</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={marginTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} unit="%" />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="proyectado" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} name="Proyectado" />
              <Line type="monotone" dataKey="real" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Real" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {projects.map((project) => {
        const rows = expensesByProject.filter((e) => e.projectId === project.id);
        if (rows.length === 0) return null;
        const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0);
        const totalActual = rows.reduce((s, r) => s + r.actual, 0);
        const totalVariance = ((totalActual - totalBudgeted) / totalBudgeted) * 100;
        return (
          <Card key={project.id} className="p-6 overflow-x-auto">
            <h2 className="text-base font-semibold text-foreground mb-4">{project.name}</h2>
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
                {rows.map((row) => {
                  const variance = ((row.actual - row.budgeted) / row.budgeted) * 100;
                  return (
                    <tr key={row.category} className="border-b border-border hover:bg-secondary transition-colors">
                      <td className="py-3 text-foreground font-medium">{row.category}</td>
                      <td className="py-3 text-right text-foreground">{formatCurrency(row.budgeted)}</td>
                      <td className="py-3 text-right text-foreground">{formatCurrency(row.actual)}</td>
                      <td className={`py-3 text-right font-medium ${variance > 0 ? "text-status-error-fg" : "text-status-success-fg"}`}>
                        {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-secondary font-semibold">
                  <td className="py-3 text-foreground">TOTAL</td>
                  <td className="py-3 text-right text-foreground">{formatCurrency(totalBudgeted)}</td>
                  <td className="py-3 text-right text-foreground">{formatCurrency(totalActual)}</td>
                  <td className={`py-3 text-right ${totalVariance > 0 ? "text-status-error-fg" : "text-status-success-fg"}`}>
                    {totalVariance > 0 ? "+" : ""}{totalVariance.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}
