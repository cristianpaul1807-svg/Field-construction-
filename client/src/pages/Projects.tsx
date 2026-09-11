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
import { useApi, apiFetch, serverMessage } from "@/lib/api";
import { previewTax, type TaxRate } from "@/lib/taxes";
import { NeedsFirst } from "@/components/NeedsFirst";
import { useSelectedProject } from "@/contexts/SelectedProjectContext";
import { useTranslation } from "react-i18next";
import { SelectorDeObra } from "@/components/SelectorDeObra";
import { useFiltroDeObra } from "@/lib/filtroDeObra";

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
      if (!res.ok) throw new Error(serverMessage(body, t, t("projects.createError")));
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
        {(clients ?? []).length === 0 ? (
          // Una obra es de alguien: sin clientes esto era un desplegable vacío
          // y un botón muerto, sin decir qué faltaba.
          <NeedsFirst
            message={t("common.needsClientFirst")}
            href="/crm"
            cta={t("common.goCreateClient")}
            onNavigate={() => setOpen(false)}
          />
        ) : (
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
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Projects() {
  const { t } = useTranslation();
  // La provincia del negocio y sus tasas, para poder decir qué paga el cliente
  // sin recalcular el impuesto en cada tarjeta.
  const { data: tasas } = useApi<TaxRate[]>("/api/canada-tax-rates");
  const { data: empresa } = useApi<{ province: string }>("/api/settings/company");
  const tasaDelNegocio = tasas?.find((r) => r.province === empresa?.province) ?? null;
  const { reloadProjects } = useSelectedProject();
  const [reloadToken, setReloadToken] = useState(0);
  const { data: projects, loading, error } = useApi<Project[]>(`/api/projects?_r=${reloadToken}`);
  // Aquí el filtro deja una sola tarjeta, y aun así se aplica: una pantalla
  // que ignorara el selector haría dudar de si filtra en las demás.
  const { filtrar } = useFiltroDeObra();
  const visibles = filtrar(projects, (p) => p.id);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={t("projects.title")}
        description={t("projects.description")}
        action={
          <NewProjectDialog
            onCreated={() => {
              setReloadToken((n) => n + 1);
              // The header's project switcher holds its own copy of the list.
              reloadProjects();
            }}
          />
        }
      />

      <SelectorDeObra />

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
          {visibles.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="p-5 hover:border-primary/40 transition-colors cursor-pointer h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {/* "Residencial" se guarda ya escrito así, no como slug, y
                        por eso se baja a minúsculas para buscar su rótulo. El
                        valor original queda de reserva si algún día hay tipos
                        que nosotros no conocemos. */}
                    {project.type && (
                      <p className="text-xs text-muted-foreground">
                        {t(`projects.types.${project.type.toLowerCase()}`, { defaultValue: project.type })}
                      </p>
                    )}
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
                  {/* "$154.500,00 / $195.273,20" no dice qué es cada número, y
                      una obra sin presupuesto enseñaba "$0,00 / $0,00", que no
                      es información sino ruido. */}
                  {/* Dos cifras sueltas no dicen que sean sin impuestos, y
                      alguien puede leer el contrato como lo que se factura.
                      El impuesto se cobra aparte y encima, y eso hay que verlo
                      escrito para no dudarlo. */}
                  <span className="text-muted-foreground">
                    {project.budgetTotal > 0
                      ? `${formatCurrency(project.budgetUsed)} / ${formatCurrency(project.budgetTotal)}`
                      : t("projects.spentOfContract", { spent: formatCurrency(project.budgetUsed) })}
                    {project.budgetTotal > 0 && (
                      <span className="block text-[11px] opacity-70">{t("budgets.beforeTax")}</span>
                    )}
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

                {/* Arriba, la cifra que dice si la obra gana dinero: contrato y
                    gasto, los dos sin impuestos. Los impuestos no son del
                    negocio —se cobran y se remiten—, así que mezclarlos ahí
                    daría un margen falso.
                    Aquí debajo, lo que el cliente va a pagar, desglosado como
                    lo verá en su factura. */}
                {project.budgetTotal > 0 && tasaDelNegocio && (
                  <div className="mt-3 pt-3 border-t border-border space-y-0.5 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground/70">{t("projects.clientPays")}</p>
                    {previewTax(project.budgetTotal, tasaDelNegocio).parts.map((parte) => (
                      <div key={parte.label} className="flex justify-between gap-3">
                        <span>{parte.label}</span>
                        <span>{formatCurrency(parte.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between gap-3 text-foreground font-medium">
                      <span>{t("common.total")}</span>
                      <span>{formatCurrency(previewTax(project.budgetTotal, tasaDelNegocio).total)}</span>
                    </div>
                  </div>
                )}
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
