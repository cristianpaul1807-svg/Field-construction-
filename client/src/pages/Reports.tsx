import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import {
  revenueVsExpense,
  projects,
  employees,
  materialsCatalog,
  formatCurrency,
} from "@/lib/mockData";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function Reports() {
  const totalRevenue = revenueVsExpense.reduce((s, r) => s + r.ingresos, 0);
  const totalExpense = revenueVsExpense.reduce((s, r) => s + r.gastos, 0);
  const profit = totalRevenue - totalExpense;
  const activeCount = projects.filter((p) => p.status === "en_progreso").length;
  const completedCount = projects.filter((p) => p.status === "completado").length;

  const hoursByEmployee = employees.map((e) => ({ name: e.name.split(" ")[0], horas: e.hoursThisPeriod }));
  const topMaterials = materialsCatalog
    .filter((m) => m.category === "Materiales" && !m.isReferenceOnly)
    .slice(0, 5);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Reports & Analytics" description="Facturación, beneficio real y rendimiento del equipo" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Facturación (6 meses)</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{formatCurrency(totalRevenue)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Beneficio real</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{formatCurrency(profit)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Proyectos activos</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{activeCount}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Proyectos finalizados</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{completedCount}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Horas trabajadas por empleado</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hoursByEmployee}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: 12 }} />
                <Bar dataKey="horas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Materiales más usados</h2>
          <div className="space-y-3">
            {topMaterials.map((m) => (
              <div key={m.id} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{m.name}</span>
                <span className="text-sm text-muted-foreground">{formatCurrency(m.price ?? 0)} / {m.unit}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
