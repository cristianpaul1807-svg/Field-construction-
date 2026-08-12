import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, workOrderStatusTone, priorityTone } from "@/components/StatusBadge";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApi, apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

const STATUSES = ["pendiente", "en_progreso", "completada"] as const;
const PRIORITIES = ["baja", "media", "alta"] as const;

interface ProjectOption { id: string; name: string }
interface AssigneeOption { id: string; name: string }

function NewWorkOrderDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("media");
  const [assignee, setAssignee] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: projects } = useApi<ProjectOption[]>(open ? "/api/projects" : null);
  const { data: employees } = useApi<AssigneeOption[]>(open ? "/api/employees" : null);
  const { data: subcontractors } = useApi<AssigneeOption[]>(open ? "/api/subcontractors" : null);

  const reset = () => { setProjectId(""); setTitle(""); setDescription(""); setPriority("media"); setAssignee(""); setError(null); };

  const create = async () => {
    if (!projectId || !title.trim()) return;
    setSaving(true); setError(null);
    try {
      // The value carries its own kind, so the server gets exactly one
      // assignee field set — the table allows at most one.
      const [kind, id] = assignee ? assignee.split(":") : [null, null];
      const res = await apiFetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description,
          priority,
          assignedEmployeeId: kind === "emp" ? id : undefined,
          assignedSubcontractorId: kind === "sub" ? id : undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || t("workOrders.createError"));
      setOpen(false); reset(); onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workOrders.createError"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 w-full sm:w-auto"><Plus size={16} /> {t("workOrders.newWorkOrder")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("workOrders.newWorkOrder")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("common.project")}</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder={t("workOrders.selectProject")} /></SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("workOrders.title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("workOrders.titlePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.description")} ({t("common.optional")})</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("workOrders.priority")}</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((v) => <SelectItem key={v} value={v}>{t(`workOrders.priorities.${v}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("workOrders.assignTo")} ({t("common.optional")})</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger><SelectValue placeholder={t("workOrders.unassigned")} /></SelectTrigger>
              <SelectContent>
                {(employees ?? []).map((e) => <SelectItem key={`emp:${e.id}`} value={`emp:${e.id}`}>{e.name}</SelectItem>)}
                {(subcontractors ?? []).map((sub) => <SelectItem key={`sub:${sub.id}`} value={`sub:${sub.id}`}>{sub.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={create} disabled={!projectId || !title.trim() || saving}>
            {saving ? t("common.creating") : t("workOrders.createWorkOrder")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  priority: (typeof PRIORITIES)[number];
  status: (typeof STATUSES)[number];
  projectName: string | null;
  assignedTo: string | null;
}

export default function WorkOrders() {
  const { t } = useTranslation();
  const { data: orders, loading, error, reload } = useApi<WorkOrder[]>("/api/work-orders");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Status is edited straight from the card rather than behind a dialog:
  // moving a work order along is the single most frequent action on this
  // screen, and it happens on a phone, on site.
  const changeStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/work-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={t("workOrders.title")}
        description={t("workOrders.description")}
        action={<NewWorkOrderDialog onCreated={reload} />}
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
        <div className="space-y-3">
          {orders?.map((order) => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{order.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{order.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {order.projectName} · {t("workOrders.assignedTo", { name: order.assignedTo ?? t("workOrders.unassigned") })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge tone={priorityTone[order.priority]}>{t(`workOrders.priorities.${order.priority}`)}</StatusBadge>
                  <StatusBadge tone={workOrderStatusTone[order.status]}>{t(`workOrders.statuses.${order.status}`)}</StatusBadge>
                  <Select
                    value={order.status}
                    onValueChange={(v) => changeStatus(order.id, v)}
                    disabled={busyId === order.id}
                  >
                    <SelectTrigger className="w-auto h-8 gap-1.5 text-xs" aria-label={t("workOrders.changeStatus")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{t(`workOrders.statuses.${s}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          ))}
          {orders?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t("workOrders.noWorkOrders")}</p>
          )}
        </div>
      )}
    </div>
  );
}
