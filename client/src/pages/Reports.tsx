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
} from "recharts";
import { useTranslation } from "react-i18next";

interface ReportsData {
  revenueByMonth: { month: string; ingresos: number; gastos: number }[];
  totalRevenue: number;
  totalExpense: number;
  profit: number;
  activeProjects: number;
  completedProjects: number;
  hoursByEmployee: { name: string; horas: number }[];
  topMaterials: { name: string; unit: string; totalQuantity: number }[];
}

export default function Reports() {
  const { t } = useTranslation();
  const { data, loading, error } = useApi<ReportsData>("/api/reports");

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader title={t("reports.title")} description={t("reports.description")} />

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

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">{t("reports.billedCollected")}</p>
              <p className="text-2xl font-semibold text-foreground mt-2">{formatCurrency(data.totalRevenue)}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">{t("reports.realProfit")}</p>
              <p className="text-2xl font-semibold text-foreground mt-2">{formatCurrency(data.profit)}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">{t("reports.activeProjects")}</p>
              <p className="text-2xl font-semibold text-foreground mt-2">{data.activeProjects}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">{t("reports.finishedProjects")}</p>
              <p className="text-2xl font-semibold text-foreground mt-2">{data.completedProjects}</p>
            </Card>
          </div>

          {data.revenueByMonth.length > 0 && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">{t("reports.revenueVsExpensesMonth")}</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: 12 }} />
                    <Bar dataKey="ingresos" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gastos" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">{t("reports.hoursByEmployee")}</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.hoursByEmployee}>
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
              <h2 className="text-base font-semibold text-foreground mb-4">{t("reports.topMaterials")}</h2>
              <div className="space-y-3">
                {data.topMaterials.map((m) => (
                  <div key={m.name} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{m.name}</span>
                    <span className="text-sm text-muted-foreground">{m.totalQuantity} {m.unit}</span>
                  </div>
                ))}
                {data.topMaterials.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("reports.noMaterials")}</p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
