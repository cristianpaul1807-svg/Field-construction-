import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, projectStatusTone } from "@/components/StatusBadge";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { formatCurrencyRounded, formatCompactCurrency, type ProjectStatus } from "@/lib/mockData";
import { useApi } from "@/lib/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useTranslation } from "react-i18next";

interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  progressPercent: number;
  team: string[];
}

interface Invoice {
  status: string;
  amount: number;
}

interface EstimateSummary {
  status: string;
}

interface ScheduleEvent {
  id: string;
  title: string;
  startTime: string;
}

interface ChatChannel {
  id: string;
  participantName: string | null;
  controlMode: "bot" | "human";
  lastMessage: string | null;
}

interface ReportsData {
  revenueByMonth: { month: string; ingresos: number; gastos: number }[];
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: projects, loading: projectsLoading } = useApi<Project[]>("/api/projects");
  const { data: invoices, loading: invoicesLoading } = useApi<Invoice[]>("/api/invoices");
  const { data: estimates, loading: estimatesLoading } = useApi<EstimateSummary[]>("/api/estimates");
  const { data: scheduleEvents, loading: scheduleLoading } = useApi<ScheduleEvent[]>("/api/schedule-events");
  const { data: chatChannels, loading: conversationsLoading } = useApi<ChatChannel[]>("/api/chat/channels?system=publico");
  const { data: reports, loading: reportsLoading } = useApi<ReportsData>("/api/reports");

  const loading =
    projectsLoading || invoicesLoading || estimatesLoading || scheduleLoading || conversationsLoading || reportsLoading;

  const activeProjects = (projects ?? []).filter((p) => p.status === "en_progreso" || p.status === "planificacion");
  const revenueByMonth = reports?.revenueByMonth ?? [];
  const monthlyRevenue = revenueByMonth.at(-1)?.ingresos ?? 0;
  const prevRevenue = revenueByMonth.at(-2)?.ingresos ?? 0;
  const revenueDelta = prevRevenue > 0 ? Math.round(((monthlyRevenue - prevRevenue) / prevRevenue) * 100) : 0;
  const pendingInvoices = (invoices ?? []).filter((i) => i.status !== "pagado");
  const pendingInvoicesTotal = pendingInvoices.reduce((sum, i) => sum + i.amount, 0);
  const pendingEstimates = (estimates ?? []).filter((e) => e.status === "enviado");
  const botConversations = (chatChannels ?? []).filter((c) => c.controlMode === "bot");

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.description")} />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}

      {!loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">{t("dashboard.activeProjects")}</p>
              <p className="text-2xl font-semibold text-foreground mt-2">{activeProjects.length}</p>
              <p className="text-xs text-muted-foreground mt-2">de {projects?.length ?? 0} totales</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">{t("dashboard.monthlyBilling")}</p>
              <p className="text-2xl font-semibold text-foreground mt-2" title={formatCurrencyRounded(monthlyRevenue)}>
                {formatCompactCurrency(monthlyRevenue)}
              </p>
              <div className="flex items-center gap-1 mt-2">
                {revenueDelta >= 0 ? (
                  <TrendingUp size={14} className="text-status-success-fg" />
                ) : (
                  <TrendingDown size={14} className="text-status-error-fg" />
                )}
                <p className={`text-xs ${revenueDelta >= 0 ? "text-status-success-fg" : "text-status-error-fg"}`}>
                  {revenueDelta >= 0 ? "+" : ""}{revenueDelta}% vs. mes anterior
                </p>
              </div>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">{t("dashboard.pendingCollections")}</p>
              <p className="text-2xl font-semibold text-foreground mt-2" title={formatCurrencyRounded(pendingInvoicesTotal)}>
                {formatCompactCurrency(pendingInvoicesTotal)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">{pendingInvoices.length} facturas</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">{t("dashboard.estimatesToApprove")}</p>
              <p className="text-2xl font-semibold text-foreground mt-2">{pendingEstimates.length}</p>
              <p className="text-xs text-muted-foreground mt-2">{t("dashboard.awaitingClient")}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">{t("dashboard.revenueVsExpenses")}</h2>
              <div className="h-56">
                {revenueByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.5rem",
                          fontSize: 12,
                        }}
                      />
                      <Line type="monotone" dataKey="ingresos" stroke="var(--chart-1)" strokeWidth={2} dot={false} name={t("dashboard.income")} />
                      <Line type="monotone" dataKey="gastos" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} name={t("dashboard.expenses")} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground flex items-center justify-center h-full">
                    {t("dashboard.noPaymentsOrExpenses")}
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-foreground">{t("dashboard.upcomingVisits")}</h2>
                <Link href="/scheduling" className="text-xs text-primary hover:underline">{t("dashboard.seeAll")}</Link>
              </div>
              <div className="space-y-3">
                {scheduleEvents?.slice(0, 4).map((event) => (
                  <div key={event.id} className="pb-3 border-b border-border last:border-0">
                    <p className="text-xs text-muted-foreground">{event.startTime?.slice(0, 16).replace("T", " ")}</p>
                    <p className="text-sm font-medium text-foreground mt-1">{event.title}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-foreground">{t("dashboard.activeProjects")}</h2>
                <Link href="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
                  {t("common.all")} <ArrowRight size={12} />
                </Link>
              </div>
              <div className="space-y-3">
                {activeProjects.map((project) => (
                  <div key={project.id} className="pb-3 border-b border-border last:border-0">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                      <StatusBadge tone={projectStatusTone[project.status]}>
                        {t(`projects.statuses.${project.status}`)}
                      </StatusBadge>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: `${project.progressPercent}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{project.progressPercent}% completado · {project.team.length} miembros</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-foreground">{t("dashboard.recentNotifications")}</h2>
                <Link href="/communication" className="text-xs text-primary hover:underline">{t("dashboard.seeInbox")}</Link>
              </div>
              <div className="space-y-3">
                {botConversations.map((conv) => (
                  <div key={conv.id} className="pb-3 border-b border-border last:border-0 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-status-success-bg flex items-center justify-center text-status-success-fg text-xs font-semibold flex-shrink-0">
                      W
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{conv.participantName}</p>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                    </div>
                    <StatusBadge tone="info">Bot</StatusBadge>
                  </div>
                ))}
                {botConversations.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("dashboard.noNotifications")}</p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
