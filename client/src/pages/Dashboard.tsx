import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, projectStatusTone } from "@/components/StatusBadge";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import {
  projects,
  invoices,
  estimates,
  scheduleEvents,
  clients,
  whatsappMessages,
  conversationControl,
  findClient,
  formatCurrency,
  leadStatusLabel,
  projectStatusLabel,
  revenueVsExpense,
} from "@/lib/mockData";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function Dashboard() {
  const activeProjects = projects.filter((p) => p.status === "en_progreso" || p.status === "planificacion");
  const monthlyRevenue = revenueVsExpense[revenueVsExpense.length - 1].ingresos;
  const prevRevenue = revenueVsExpense[revenueVsExpense.length - 2].ingresos;
  const revenueDelta = Math.round(((monthlyRevenue - prevRevenue) / prevRevenue) * 100);
  const pendingInvoices = invoices.filter((i) => i.status !== "pagado");
  const pendingInvoicesTotal = pendingInvoices.reduce((sum, i) => sum + i.amount, 0);
  const pendingEstimates = estimates.filter((e) => e.status === "enviado");

  const unansweredConversations = Object.entries(conversationControl).filter(
    ([, mode]) => mode === "bot"
  );

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader title="Dashboard" description="Resumen ejecutivo de tu negocio" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Proyectos activos</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{activeProjects.length}</p>
          <p className="text-xs text-muted-foreground mt-2">de {projects.length} totales</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Facturación del mes</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{formatCurrency(monthlyRevenue)}</p>
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
          <p className="text-sm text-muted-foreground">Cobros pendientes</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{formatCurrency(pendingInvoicesTotal)}</p>
          <p className="text-xs text-muted-foreground mt-2">{pendingInvoices.length} facturas</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Presupuestos por aprobar</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{pendingEstimates.length}</p>
          <p className="text-xs text-muted-foreground mt-2">Esperando respuesta del cliente</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Ingresos vs. Gastos</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueVsExpense}>
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
                <Line type="monotone" dataKey="ingresos" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Ingresos" />
                <Line type="monotone" dataKey="gastos" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} name="Gastos" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Próximas visitas</h2>
            <Link href="/scheduling" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          <div className="space-y-3">
            {scheduleEvents.slice(0, 4).map((event) => (
              <div key={event.id} className="pb-3 border-b border-border last:border-0">
                <p className="text-xs text-muted-foreground">{event.date} · {event.time}</p>
                <p className="text-sm font-medium text-foreground mt-1">{event.title}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Proyectos activos</h2>
            <Link href="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {activeProjects.map((project) => (
              <div key={project.id} className="pb-3 border-b border-border last:border-0">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                  <StatusBadge tone={projectStatusTone[project.status]}>
                    {projectStatusLabel[project.status]}
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
            <h2 className="text-base font-semibold text-foreground">Notificaciones recientes</h2>
            <Link href="/communication" className="text-xs text-primary hover:underline">Ver bandeja</Link>
          </div>
          <div className="space-y-3">
            {unansweredConversations.map(([clientId]) => {
              const client = findClient(clientId);
              const lastMessage = [...whatsappMessages].reverse().find((m) => m.clientId === clientId);
              if (!client || !lastMessage) return null;
              return (
                <div key={clientId} className="pb-3 border-b border-border last:border-0 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-status-success-bg flex items-center justify-center text-status-success-fg text-xs font-semibold flex-shrink-0">
                    W
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{client.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lastMessage.content}</p>
                  </div>
                  <StatusBadge tone="info">Bot</StatusBadge>
                </div>
              );
            })}
            {clients.filter((c) => c.leadStatus === "cotizado").slice(0, 1).map((c) => (
              <div key={c.id} className="pb-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-status-warning-bg flex items-center justify-center text-status-warning-fg text-xs font-semibold flex-shrink-0">
                  !
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">Presupuesto enviado, sin respuesta ({leadStatusLabel[c.leadStatus]})</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
