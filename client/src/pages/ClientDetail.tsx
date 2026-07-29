import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, leadStatusTone } from "@/components/StatusBadge";
import { ArrowLeft, Phone, MessageCircle, StickyNote, FileText } from "lucide-react";
import {
  clients,
  activities,
  estimates,
  projects,
  leadStatusLabel,
  formatCurrency,
} from "@/lib/mockData";

const activityIcon = {
  call: Phone,
  whatsapp: MessageCircle,
  note: StickyNote,
  estimate_sent: FileText,
};

export default function ClientDetail() {
  const { id } = useParams();
  const client = clients.find((c) => c.id === id);

  if (!client) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center text-muted-foreground">
        Cliente no encontrado.{" "}
        <Link href="/crm" className="text-primary hover:underline">Volver al CRM</Link>
      </div>
    );
  }

  const clientActivities = activities.filter((a) => a.clientId === client.id);
  const clientEstimates = estimates.filter((e) => e.clientId === client.id);
  const clientProjects = projects.filter((p) => p.clientId === client.id);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <Link href="/crm" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Volver al CRM
      </Link>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold flex-shrink-0">
            {client.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{client.name}</h1>
            <p className="text-sm text-muted-foreground">{client.phone} · {client.email}</p>
          </div>
        </div>
        <StatusBadge tone={leadStatusTone[client.leadStatus]}>
          {leadStatusLabel[client.leadStatus]}
        </StatusBadge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Timeline de actividad</h2>
            <div className="space-y-4">
              {clientActivities.map((activity) => {
                const Icon = activityIcon[activity.type];
                return (
                  <div key={activity.id} className="flex gap-3 pb-4 border-b border-border last:border-0">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <Icon size={14} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{activity.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.createdBy} · {activity.createdAt}
                      </p>
                    </div>
                  </div>
                );
              })}
              {clientActivities.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin actividad registrada todavía.</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Presupuestos enviados</h2>
            <div className="space-y-3">
              {clientEstimates.map((estimate) => {
                const total = estimate.lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
                return (
                  <div key={estimate.id} className="flex items-center justify-between pb-3 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">#{estimate.id.toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">{estimate.createdAt}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{formatCurrency(total)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{estimate.status}</p>
                    </div>
                  </div>
                );
              })}
              {clientEstimates.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin presupuestos todavía.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-3 text-sm">Ficha del cliente</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Dirección</dt>
                <dd className="text-foreground">{client.address}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Origen del lead</dt>
                <dd className="text-foreground">{client.source}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Cliente desde</dt>
                <dd className="text-foreground">{client.createdAt}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-3 text-sm">Proyectos</h3>
            <div className="space-y-2">
              {clientProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block text-sm text-foreground hover:text-primary"
                >
                  {project.name}
                </Link>
              ))}
              {clientProjects.length === 0 && (
                <p className="text-xs text-muted-foreground">Aún sin proyectos vinculados.</p>
              )}
            </div>
          </Card>

          <Button variant="outline" className="w-full gap-2" asChild>
            <Link href="/communication">
              <MessageCircle size={14} /> Ver conversación de WhatsApp
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
