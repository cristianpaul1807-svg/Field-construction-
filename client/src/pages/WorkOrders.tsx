import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, workOrderStatusTone, priorityTone } from "@/components/StatusBadge";
import { Plus, Trash2, CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApi, apiFetch, serverMessage } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { mensajeDeChoque } from "@/lib/conflicto";
import { Codigo } from "@/components/Codigo";
import { FiltradoPorObra } from "@/components/FiltradoPorObra";
import { useFiltroDeObra } from "@/lib/filtroDeObra";
import { useTiposDeTrabajo, nombreDeTipo, nombreDeSlug } from "@/lib/tiposDeTrabajo";

const STATUSES = ["pendiente", "en_progreso", "completada"] as const;
const SIN_ESPECIFICAR = "sin_especificar";

const PRIORITIES = ["baja", "media", "alta"] as const;

interface ProjectOption { id: string; name: string }
interface AssigneeOption { id: string; name: string }

function NewWorkOrderDialog({ onCreated }: { onCreated: () => void }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("media");
  const [assignee, setAssignee] = useState("");
  const [serviceType, setServiceType] = useState<string>(SIN_ESPECIFICAR);
  // Opcionales: una orden sin fecha sigue siendo una orden ("hay que hacer
  // esto"), sólo que no sale en la agenda hasta que se decida cuándo.
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: projects } = useApi<ProjectOption[]>(open ? "/api/projects" : null);
  const { data: employees } = useApi<AssigneeOption[]>(open ? "/api/employees" : null);
  const { data: subcontractors } = useApi<AssigneeOption[]>(open ? "/api/subcontractors" : null);
  const { data: tipos } = useTiposDeTrabajo();

  const reset = () => { setProjectId(""); setTitle(""); setDescription(""); setPriority("media"); setAssignee(""); setServiceType(SIN_ESPECIFICAR); setDate(""); setTime("09:00"); setDurationMinutes(60); setError(null); };

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
          serviceType: serviceType === SIN_ESPECIFICAR ? null : serviceType,
          scheduledStart: date ? new Date(`${date}T${time}:00`).toISOString() : null,
          durationMinutes: date ? durationMinutes : null,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(mensajeDeChoque(body, t, i18n.language) ?? serverMessage(body, t, t("workOrders.createError")));
      }
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
          {/* Dicho aquí, el trabajador lo hereda al fichar esta orden en vez de
              tener que contestarlo a pie de obra. Igual que en la agenda. */}
          <div className="space-y-1.5">
            <Label>{t("worker.serviceType")} ({t("common.optional")})</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_ESPECIFICAR}>{t("worker.serviceTypes.sin_especificar")}</SelectItem>
                {/* Con su letra delante: es la que va a acabar dentro del
                    número de obra, y verla aquí es lo que hace que el número
                    se entienda en vez de parecer una matrícula. */}
                {(tipos ?? []).map((v) => (
                  <SelectItem key={v.slug} value={v.slug}>
                    {v.letter} · {nombreDeTipo(v, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Ponerle fecha es lo que la hace aparecer en la agenda. Sin ella
              se queda en la lista de pendientes, que es un sitio legítimo. */}
          <div className="space-y-1.5">
            <Label>{t("workOrders.scheduleFor", { opt: t("common.optional") })}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} />
            </div>
          </div>
          {date && (
            <div className="space-y-1.5">
              <Label>{t("workOrders.durationLabel")}</Label>
              <Input
                type="number"
                min={15}
                step={15}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)}
              />
            </div>
          )}
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
  projectId: string | null;
  title: string;
  description: string;
  priority: (typeof PRIORITIES)[number];
  status: (typeof STATUSES)[number];
  serviceType: string | null;
  projectName: string | null;
  assignedTo: string | null;
  /** El número de obra, emitido al crearla. Nulo sólo si nació sin obra. */
  commessa: string | null;
  /** Nulo mientras nadie haya decidido cuándo. Sin esto no sale en la agenda. */
  scheduledStart: string | null;
  durationMinutes: number | null;
}

/**
 * Ponerle fecha a una orden que ya existe, o moverla.
 *
 * Antes la fecha sólo se podía poner al crearla, así que las órdenes de antes
 * de la agenda se quedaban fuera del calendario para siempre: la única salida
 * era borrarlas y volver a escribirlas. Y la fecha es justo lo que hace que
 * una orden aparezca donde el trabajador la va a ver.
 */
function ScheduleDialog({ order, onSaved }: { order: WorkOrder; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const inicial = order.scheduledStart ? new Date(order.scheduledStart) : null;
  const comoFecha = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const comoHora = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const [date, setDate] = useState(inicial ? comoFecha(inicial) : "");
  const [time, setTime] = useState(inicial ? comoHora(inicial) : "09:00");
  const [durationMinutes, setDurationMinutes] = useState(order.durationMinutes ?? 60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (quitar: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/work-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledStart: quitar || !date ? null : new Date(`${date}T${time}:00`).toISOString(),
          durationMinutes: quitar || !date ? null : durationMinutes,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(mensajeDeChoque(body, t, i18n.language) ?? serverMessage(body, t, t("workOrders.scheduleError")));
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workOrders.scheduleError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
          <CalendarClock size={14} />
          {order.scheduledStart ? t("workOrders.reschedule") : t("workOrders.schedule")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{order.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("common.date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("scheduling.time")}</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("workOrders.durationLabel")}</Label>
            <Input
              type="number"
              min={15}
              step={15}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              disabled={!date}
            />
          </div>
          {/* Se dice lo que consigue poner la fecha, porque desde esta pantalla
              no se ve: una orden sin asignar puede tener fecha y aun así nadie
              la va a fichar. */}
          <p className="text-xs text-muted-foreground">
            {order.assignedTo
              ? t("workOrders.scheduleHint", { name: order.assignedTo })
              : t("workOrders.scheduleHintUnassigned")}
          </p>
          {error && (
            <div className="rounded-lg border border-border bg-status-error-bg/40 p-3 text-sm text-status-error-fg">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => guardar(false)} disabled={saving || !date}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
            {order.scheduledStart && (
              <Button variant="outline" onClick={() => guardar(true)} disabled={saving}>
                {t("workOrders.clearSchedule")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkOrders() {
  const { t, i18n } = useTranslation();
  const { data: orders, loading, error, reload } = useApi<WorkOrder[]>("/api/work-orders");
  const { data: tipos } = useTiposDeTrabajo();
  const { filtrar } = useFiltroDeObra();
  const visibles = filtrar(orders, (o) => o.projectId);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Status is edited straight from the card rather than behind a dialog:
  // moving a work order along is the single most frequent action on this
  // screen, and it happens on a phone, on site.
  const removeOrder = async (id: string) => {
    if (!window.confirm(t("workOrders.deleteConfirm"))) return;
    const res = await apiFetch(`/api/work-orders/${id}`, { method: "DELETE" });
    if (res.ok) reload();
  };

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
      {/* workOrders.title es el rótulo del campo "Título" del formulario de más
          arriba. Reutilizarlo aquí hacía que la página se llamara "Título". */}
      <PageHeader
        title={t("workOrders.pageTitle")}
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

      <FiltradoPorObra />

      {!loading && !error && (
        <div className="space-y-3">
          {visibles.map((order) => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  {/* El número va encima del título y no al lado: es por lo
                      que se pregunta el trabajo, y se lee antes que el
                      nombre que alguien le puso aquel día. */}
                  <Codigo code={order.commessa} className="mb-1" />
                  <p className="font-medium text-foreground">{order.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{order.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {/* "Asignado a Sin asignar" era lo que salía cuando no hay
                        nadie, y eso no lo escribiría una persona. */}
                    {order.projectName} ·{" "}
                    {order.assignedTo ? t("workOrders.assignedTo", { name: order.assignedTo }) : t("workOrders.unassigned")}
                    {" · "}
                    <span className={order.serviceType ? undefined : "italic"}>
                      {nombreDeSlug(order.serviceType, tipos, t)}
                    </span>
                  </p>
                  {/* Cuándo. Es lo que decide si la orden sale en la agenda y
                      si el trabajador la ve al fichar, así que tiene que
                      leerse en la tarjeta y no sólo dentro del diálogo. */}
                  {/* De una orden terminada sin fecha no hay nada que decir
                      —ya se hizo—, así que sólo falta el "sin fecha" ahí. */}
                  {(order.scheduledStart || order.status !== "completada") && (
                    <p className="text-xs mt-1.5 flex items-center gap-1.5">
                      <CalendarClock size={12} className="text-muted-foreground flex-shrink-0" />
                      {order.scheduledStart ? (
                        <span className="text-foreground">
                          {new Date(order.scheduledStart).toLocaleString(i18n.language, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground">{t("workOrders.notScheduled")}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <StatusBadge tone={priorityTone[order.priority]}>{t(`workOrders.priorities.${order.priority}`)}</StatusBadge>
                  <StatusBadge tone={workOrderStatusTone[order.status]}>{t(`workOrders.statuses.${order.status}`)}</StatusBadge>
                  {/* Lo ya terminado no se programa: ponerle fecha a mañana a
                      algo que está hecho no significa nada. */}
                  {order.status !== "completada" && <ScheduleDialog order={order} onSaved={reload} />}
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
                  <button
                    aria-label={t("common.delete")}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-status-error-fg hover:bg-secondary transition-colors"
                    onClick={() => removeOrder(order.id)}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
          {visibles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t("workOrders.noWorkOrders")}</p>
          )}
        </div>
      )}
    </div>
  );
}
