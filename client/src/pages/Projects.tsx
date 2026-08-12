import { useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, projectStatusTone } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { formatCurrency, type ProjectStatus } from "@/lib/mockData";
import { useApi, apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface Project {
  id: string;
  clientName: string | null;
  name: string;
  type: string;
  status: ProjectStatus;
  progressPercent: number;
  budgetTotal: number;
  budgetUsed: number;
  team: string[];
}

interface ClientOption { id: string; name: string }

function NewProjectDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: clients } = useApi<ClientOption[]>(open ? "/api/clients" : null);

  const reset = () => { setClientId(""); setName(""); setType(""); setStartDate(""); setEndDate(""); setError(null); };

  const create = async () => {
    if (!clientId || !name.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, name: name.trim(), type, startDate: startDate || undefined, endDate: endDate || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || t("projects.createError"));
      setOpen(false); reset(); onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("projects.createError"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 w-full sm:w-auto"><Plus size={16} /> {t("projects.newProject")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("projects.newProject")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("common.client")}</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder={t("projects.selectClient")} /></SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("projects.projectName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{t("projects.projectType")} ({t("common.optional")})</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder={t("projects.typePlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("projects.startDate")}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("projects.endDate")}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={create} disabled={!clientId || !name.trim() || saving}>
            {saving ? t("common.creating") : t("projects.createProject")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Projects() {
  const { t } = useTranslation();
  const [reloadToken, setReloadToken] = useState(0);
  const { data: projects, loading, error } = useApi<Project[]>(`/api/projects?_r=${reloadToken}`);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={t("projects.title")}
        description={t("projects.description")}
        action={<NewProjectDialog onCreated={() => setReloadToken((n) => n + 1)} />}
      />

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

      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="p-5 hover:border-primary/40 transition-colors cursor-pointer h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{project.type}</p>
                    <h3 className="font-semibold text-foreground mt-0.5 truncate">{project.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{project.clientName}</p>
                  </div>
                  <StatusBadge tone={projectStatusTone[project.status]}>
                    {t(`projects.statuses.${project.status}`)}
                  </StatusBadge>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{t("projects.progress")}</span>
                    <span>{project.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${project.progressPercent}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 text-sm">
                  <span className="text-muted-foreground">
                    {formatCurrency(project.budgetUsed)} / {formatCurrency(project.budgetTotal)}
                  </span>
                  <div className="flex -space-x-2">
                    {project.team.slice(0, 3).map((member) => (
                      <div
                        key={member}
                        className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center border-2 border-card"
                        title={member}
                      >
                        {member.charAt(0)}
                      </div>
                    ))}
                    {project.team.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-secondary text-[10px] font-semibold flex items-center justify-center border-2 border-card">
                        +{project.team.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {projects?.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-8">
              {t("projects.noProjectsForBusiness")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
