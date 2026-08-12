import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, projectStatusTone } from "@/components/StatusBadge";
import { ArrowLeft, FileText, MessageCircle, MapPin, SlidersHorizontal, Plus } from "lucide-react";
import { formatCurrency, type ProjectStatus } from "@/lib/mockData";
import { useApi, apiFetch, downloadFile } from "@/lib/api";
import { useTranslation } from "react-i18next";

const PROJECT_STATUSES: ProjectStatus[] = ["planificacion", "en_progreso", "pausado", "completado"];

interface ProjectDetailResponse {
  id: string;
  clientId: string | null;
  clientName: string | null;
  clientAddress: string | null;
  estimateId: string | null;
  name: string;
  type: string;
  status: ProjectStatus;
  progressPercent: number;
  startDate: string;
  endDate: string;
  team: string[];
  estimateLines: { id: string; zone: string; category: string; item: string; total: number }[];
  expenses: { id: string; category: string; description: string; amount: number; date: string }[];
  documents: { id: string; name: string; tag: string; uploadedAt: string }[];
  photos: { id: string; zone: string; visibleToClient: boolean; timestamp: string }[];
  scheduleEvents: { id: string; title: string; type: string; startTime: string }[];
  changeOrders: {
    id: string;
    title: string;
    description: string | null;
    amount: number;
    status: "borrador" | "enviado" | "aprobado" | "rechazado";
    createdAt: string;
    decidedAt: string | null;
  }[];
}

const CHANGE_ORDER_STATUSES = ["borrador", "enviado", "aprobado", "rechazado"] as const;

const changeOrderTone: Record<string, "neutral" | "info" | "success" | "error"> = {
  borrador: "neutral",
  enviado: "info",
  aprobado: "success",
  rechazado: "error",
};

// Deterministic placeholder color per photo id — no image storage wired up yet.
function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `oklch(0.74 0.07 ${hash % 360})`;
}

export default function ProjectDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const { data: project, loading, error, reload } = useApi<ProjectDetailResponse>(id ? `/api/projects/${id}` : null);

  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<ProjectStatus>("planificacion");
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [changeOrderOpen, setChangeOrderOpen] = useState(false);
  const [coTitle, setCoTitle] = useState("");
  const [coDescription, setCoDescription] = useState("");
  const [coAmount, setCoAmount] = useState("");
  const [coSaving, setCoSaving] = useState(false);
  const [coError, setCoError] = useState<string | null>(null);

  const createChangeOrder = async () => {
    if (!coTitle.trim()) {
      setCoError(t("changeOrders.titleRequired"));
      return;
    }
    setCoSaving(true);
    setCoError(null);
    try {
      const res = await apiFetch("/api/change-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, title: coTitle, description: coDescription, amount: coAmount || 0 }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || t("common.genericError"));
      setChangeOrderOpen(false);
      setCoTitle("");
      setCoDescription("");
      setCoAmount("");
      reload();
    } catch (err) {
      setCoError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setCoSaving(false);
    }
  };

  const setChangeOrderStatus = async (changeOrderId: string, status: string) => {
    const res = await apiFetch(`/api/change-orders/${changeOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) reload();
  };

  useEffect(() => {
    if (!project) return;
    setStatus(project.status);
    setProgress(project.progressPercent);
  }, [project]);

  const downloadEstimate = async () => {
    if (!project?.estimateId) return;
    setDownloadingPdf(true);
    try {
      await downloadFile(
        `/api/estimates/${project.estimateId}/pdf?download=1&lang=${i18n.language.slice(0, 2)}`,
        `${t("budgets.estimateFilePrefix")}-${project.estimateId.slice(0, 8).toUpperCase()}.pdf`
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  const saveProgress = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, progressPercent: progress }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || t("projects.saveError"));
      setEditing(false);
      reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("projects.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("common.loading")}
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center text-muted-foreground">
        {error ? t("common.loadError", { message: error }) : t("projects.notFound")}{" "}
        <Link href="/projects" className="text-primary hover:underline">{t("projects.backToProjects")}</Link>
      </div>
    );
  }

  // An approved change order is part of the contract price now, so leaving it
  // out of the total would make every project look under budget.
  const approvedChanges = project.changeOrders
    .filter((c) => c.status === "aprobado")
    .reduce((sum, c) => sum + c.amount, 0);
  const budgetTotal = project.estimateLines.reduce((sum, l) => sum + l.total, 0) + approvedChanges;
  const budgetUsed = project.expenses.reduce((sum, e) => sum + e.amount, 0);

  const expensesByCategory = ["Materiales", "Mano de obra", "Subcontratistas"]
    .map((category) => ({
      category,
      budgeted: project.estimateLines.filter((l) => l.category === category).reduce((s, l) => s + l.total, 0),
      actual: project.expenses.filter((e) => e.category === category).reduce((s, e) => s + e.amount, 0),
    }))
    .filter((row) => row.budgeted > 0 || row.actual > 0);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> {t("projects.backToProjects")}
      </Link>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{project.clientName} · {project.type}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge tone={projectStatusTone[project.status]}>
            {t(`projects.statuses.${project.status}`)}
          </StatusBadge>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditing(true)}>
            <SlidersHorizontal size={14} strokeWidth={1.75} /> {t("projects.editProgress")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="summary">{t("projects.summary")}</TabsTrigger>
          <TabsTrigger value="budget">{t("projects.estimate")}</TabsTrigger>
          <TabsTrigger value="expenses">{t("projects.expenses")}</TabsTrigger>
          <TabsTrigger value="documents">{t("projects.documents")}</TabsTrigger>
          <TabsTrigger value="photos">{t("projects.photos")}</TabsTrigger>
          <TabsTrigger value="changeOrders">{t("changeOrders.tab")}</TabsTrigger>
          <TabsTrigger value="schedule">{t("projects.schedule")}</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold text-foreground mb-4 text-sm">{t("projects.progress")}</h3>
                <div className="w-full bg-secondary rounded-full h-2 mb-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${project.progressPercent}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{t("projects.percentComplete", { percent: project.progressPercent })}</p>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold text-foreground mb-3 text-sm">{t("projects.assignedTeam")}</h3>
                <div className="space-y-2">
                  {project.team.map((member) => (
                    <div key={member} className="flex items-center gap-2 text-sm text-foreground">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                        {member.charAt(0)}
                      </div>
                      <span>{member}</span>
                    </div>
                  ))}
                  {project.team.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t("projects.noTeamYet")}</p>
                  )}
                </div>
              </Card>
            </div>
            <div className="space-y-4">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">{t("projects.estimate")}</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(budgetUsed)} / {formatCurrency(budgetTotal)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">{t("projects.dates")}</p>
                <p className="text-sm text-foreground mt-1">{project.startDate} → {project.endDate}</p>
              </Card>
              {/* Both of these hand off to something that already works
                  rather than reimplementing it here: the internal chat with
                  this client, and whatever map app the device prefers. */}
              <Link href="/communication">
                <Button variant="outline" className="w-full gap-2">
                  <MessageCircle size={14} /> {t("projects.sendUpdate")}
                </Button>
              </Link>
              {project.clientAddress && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.clientAddress)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" className="w-full gap-2">
                    <MapPin size={14} /> {t("projects.viewLocation")}
                  </Button>
                </a>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <Card className="p-6">
            {project.estimateLines.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm">{t("projects.linkedEstimate")}</h3>
                  {project.estimateId && (
                    <Button size="sm" variant="outline" className="gap-2" onClick={downloadEstimate} disabled={downloadingPdf}>
                      {downloadingPdf ? <Spinner className="size-3.5" /> : <FileText size={14} />}
                      {t("projects.viewPdf")}
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">{t("projects.zone")}</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">{t("common.category")}</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">{t("projects.item")}</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">{t("common.total")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.estimateLines.map((line) => (
                        <tr key={line.id} className="border-b border-border last:border-0">
                          <td className="py-2 text-foreground">{line.zone}</td>
                          <td className="py-2 text-muted-foreground">{line.category}</td>
                          <td className="py-2 text-muted-foreground">{line.item}</td>
                          <td className="py-2 text-right text-foreground">{formatCurrency(line.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("projects.noLinkedEstimate")}</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <Card className="p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("common.category")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t("projects.budgeted")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t("projects.real")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t("projects.deviation")}</th>
                </tr>
              </thead>
              <tbody>
                {expensesByCategory.map((row) => {
                  const variance = row.budgeted > 0 ? ((row.actual - row.budgeted) / row.budgeted) * 100 : null;
                  return (
                    <tr key={row.category} className="border-b border-border last:border-0">
                      <td className="py-3 text-foreground font-medium">{row.category}</td>
                      <td className="py-3 text-right text-foreground">{formatCurrency(row.budgeted)}</td>
                      <td className="py-3 text-right text-foreground">{formatCurrency(row.actual)}</td>
                      <td className={`py-3 text-right font-medium ${variance === null ? "text-muted-foreground" : variance > 0 ? "text-status-error-fg" : "text-status-success-fg"}`}>
                        {variance === null ? "—" : `${variance > 0 ? "+" : ""}${variance.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
                {expensesByCategory.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      {t("projects.noExpensesYet")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card className="p-6">
            <div className="space-y-2">
              {project.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={16} className="text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.uploadedAt?.slice(0, 10)}</p>
                    </div>
                  </div>
                  <StatusBadge tone="neutral" className="capitalize flex-shrink-0">{doc.tag}</StatusBadge>
                </div>
              ))}
              {project.documents.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("projects.noDocumentsYet")}</p>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <Card className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {project.photos.map((photo) => (
                <div key={photo.id} className="space-y-1.5">
                  <div className="aspect-square rounded-lg border border-border" style={{ background: colorForId(photo.id) }} />
                  <p className="text-xs text-muted-foreground truncate">{photo.zone}</p>
                  <StatusBadge tone={photo.visibleToClient ? "success" : "neutral"}>
                    {photo.visibleToClient ? t("projects.visibleToClient") : t("projects.internalPhoto")}
                  </StatusBadge>
                </div>
              ))}
              {project.photos.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">{t("projects.noPhotosYet")}</p>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="changeOrders" className="mt-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-foreground text-sm">{t("changeOrders.tab")}</h3>
              <Button size="sm" className="gap-2" onClick={() => { setCoError(null); setChangeOrderOpen(true); }}>
                <Plus size={14} strokeWidth={1.75} /> {t("changeOrders.new")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{t("changeOrders.hint")}</p>

            <div className="space-y-3">
              {project.changeOrders.map((co) => (
                <div key={co.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 py-3 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{co.title}</p>
                    {co.description && <p className="text-xs text-muted-foreground mt-0.5">{co.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{co.createdAt?.slice(0, 10)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-sm font-medium ${co.amount < 0 ? "text-status-success-fg" : "text-foreground"}`}>
                      {formatCurrency(co.amount)}
                    </span>
                    <StatusBadge tone={changeOrderTone[co.status]}>{t(`changeOrders.status.${co.status}`)}</StatusBadge>
                    <Select value={co.status} onValueChange={(v) => setChangeOrderStatus(co.id, v)}>
                      <SelectTrigger className="w-auto h-8 gap-1.5 text-xs" aria-label={t("workOrders.changeStatus")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHANGE_ORDER_STATUSES.map((st) => (
                          <SelectItem key={st} value={st}>{t(`changeOrders.status.${st}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              {project.changeOrders.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("changeOrders.none")}</p>
              )}
              {approvedChanges !== 0 && (
                <div className="flex justify-between pt-3 border-t border-border text-sm font-semibold">
                  <span className="text-foreground">{t("changeOrders.approvedTotal")}</span>
                  <span className="text-foreground">{formatCurrency(approvedChanges)}</span>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <Card className="p-6">
            <div className="space-y-3">
              {project.scheduleEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.startTime}</p>
                  </div>
                  <StatusBadge tone="neutral" className="capitalize">{event.type}</StatusBadge>
                </div>
              ))}
              {project.scheduleEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("projects.noEventsYet")}</p>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={changeOrderOpen} onOpenChange={setChangeOrderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("changeOrders.new")}</DialogTitle>
            <DialogDescription>{t("changeOrders.newHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="co-title">{t("common.title")}</Label>
              <Input
                id="co-title"
                value={coTitle}
                onChange={(e) => setCoTitle(e.target.value)}
                placeholder={t("changeOrders.titlePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-description">{t("common.description")}</Label>
              <Textarea
                id="co-description"
                rows={3}
                value={coDescription}
                onChange={(e) => setCoDescription(e.target.value)}
                placeholder={t("changeOrders.descriptionPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-amount">{t("common.amount")}</Label>
              <Input
                id="co-amount"
                type="number"
                step="0.01"
                value={coAmount}
                onChange={(e) => setCoAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">{t("changeOrders.amountHint")}</p>
            </div>
            {coError && <p className="text-sm text-status-error-fg">{coError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOrderOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={createChangeOrder} disabled={coSaving}>
              {coSaving ? t("common.loading") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("projects.editProgress")}</DialogTitle>
            <DialogDescription>{t("projects.editProgressHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("common.status")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{t(`projects.statuses.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <Label>{t("projects.progress")}</Label>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            {saveError && <p className="text-sm text-status-error-fg">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
            <Button onClick={saveProgress} disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
