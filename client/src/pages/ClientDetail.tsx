import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, leadStatusTone } from "@/components/StatusBadge";
import { ArrowLeft, Phone, MessageCircle, StickyNote, FileText } from "lucide-react";
import { leadStatusLabel, formatCurrency, type LeadStatus } from "@/lib/mockData";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";

const activityIcon = {
  call: Phone,
  whatsapp: MessageCircle,
  note: StickyNote,
  estimate_sent: FileText,
};

interface ClientDetailResponse {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  leadStatus: LeadStatus;
  source: string;
  createdAt: string;
  activities: {
    id: string;
    type: keyof typeof activityIcon;
    content: string;
    createdBy: string;
    createdAt: string;
  }[];
  estimates: { id: string; status: string; total: number; createdAt: string }[];
  projects: { id: string; name: string }[];
}

export default function ClientDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: client, loading, error } = useApi<ClientDetailResponse>(id ? `/api/clients/${id}` : null);

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> Cargando cliente...
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center text-muted-foreground">
        {error ? `No se pudo cargar desde Supabase: ${error}` : "Cliente no encontrado."}{" "}
        <Link href="/crm" className="text-primary hover:underline">{t("clientDetail.backToCrm")}</Link>
      </div>
    );
  }

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
            <h2 className="text-base font-semibold text-foreground mb-4">{t("clientDetail.activityTimeline")}</h2>
            <div className="space-y-4">
              {client.activities.map((activity) => {
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
              {client.activities.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("clientDetail.noActivity")}</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">{t("clientDetail.sentEstimates")}</h2>
            <div className="space-y-3">
              {client.estimates.map((estimate) => (
                <div key={estimate.id} className="flex items-center justify-between pb-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">#{estimate.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">{estimate.createdAt}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{formatCurrency(estimate.total)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{estimate.status}</p>
                  </div>
                </div>
              ))}
              {client.estimates.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("clientDetail.noEstimates")}</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-3 text-sm">{t("clientDetail.title")}</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t("common.address")}</dt>
                <dd className="text-foreground">{client.address}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("clientDetail.leadSource")}</dt>
                <dd className="text-foreground">{client.source}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("clientDetail.clientSince")}</dt>
                <dd className="text-foreground">{client.createdAt?.slice(0, 10)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-3 text-sm">{t("clientDetail.projects")}</h3>
            <div className="space-y-2">
              {client.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block text-sm text-foreground hover:text-primary"
                >
                  {project.name}
                </Link>
              ))}
              {client.projects.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("clientDetail.noProjects")}</p>
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
