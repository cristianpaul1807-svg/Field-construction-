import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ScheduleEventDialog } from "@/components/ScheduleEventDialog";
import { ChevronLeft, ChevronRight, ClipboardList, Plus, StickyNote, X } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import { MonthGrid, claveDia, type DiaMarcado } from "@/components/MonthGrid";
import { useSelectedProject } from "@/contexts/SelectedProjectContext";
import { SelectorDeObra } from "@/components/SelectorDeObra";
import { hashColor, cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface ScheduleEvent {
  id: string;
  /** Una cita de la agenda o una orden de trabajo con fecha: se pintan igual
   *  pero no se borran igual, y no viven en la misma tabla. */
  kind: "cita" | "orden";
  title: string;
  type: string | null;
  priority: string | null;
  status: string | null;
  serviceType: string | null;
  startTime: string;
  endTime: string | null;
  notes: string | null;
  projectId: string | null;
  /** La API ya lo mandaba; hacía falta desde que la agenda enseña varias obras. */
  projectName: string | null;
  assignedWorkerId: string | null;
  assignedWorkerName: string | null;
}

const HOUR_HEIGHT = 64; // px per hour — grid cells sized by appointment duration, same mechanic as Trimm's calendar

function isSameDay(iso: string, date: Date) {
  const d = new Date(iso);
  return d.toDateString() === date.toDateString();
}

// Greedy interval layout: events that overlap in time share the row side
// by side in lanes, instead of stacking in separate per-worker columns.
function layoutEvents(events: ScheduleEvent[]) {
  const sorted = [...events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const laneEnds: number[] = [];
  const placed = sorted.map((event) => {
    const start = new Date(event.startTime).getTime();
    const end = new Date(event.endTime ?? event.startTime).getTime() || start + 30 * 60000;
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    return { event, lane };
  });
  const laneCount = Math.max(laneEnds.length, 1);
  return placed.map((p) => ({ ...p, laneCount }));
}

function blockDetail(heightPx: number) {
  if (heightPx < 28) return { padding: "px-1.5 py-0.5", text: "text-[9px]", showSubtitle: false };
  if (heightPx < 46) return { padding: "px-2 py-1", text: "text-[10px]", showSubtitle: true };
  return { padding: "px-2.5 py-1.5", text: "text-xs", showSubtitle: true };
}

export default function Scheduling() {
  const { t, i18n } = useTranslation();
  const { selectedProjectId, selectedProject } = useSelectedProject();
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: events, loading, error, reload } = useApi<ScheduleEvent[]>("/api/schedule-events");

  const [vista, setVista] = useState<"dia" | "mes">("dia");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialDate, setDialogInitialDate] = useState(new Date());

  // Cada cosa se borra donde vive: una orden de trabajo no es una cita, y
  // mandarla a /schedule-events daría un 404 silencioso que deja el bloque en
  // pantalla como si nada hubiera pasado.
  const removeEvent = async (id: string, kind: "cita" | "orden") => {
    if (!window.confirm(t(kind === "orden" ? "scheduling.deleteOrderConfirm" : "scheduling.deleteConfirm"))) return;
    const ruta = kind === "orden" ? `/api/work-orders/${id}` : `/api/schedule-events/${id}`;
    const res = await apiFetch(ruta, { method: "DELETE" });
    if (res.ok) reload();
  };

  // Sin obra elegida se ve la semana entera del negocio, que es lo que espera
  // quien abre "Agenda": antes se le pedía elegir una obra primero y el
  // calendario del negocio no existía en ninguna pantalla. El selector de
  // arriba pasa a ser lo que siempre debió ser, un filtro.
  const dayEvents = useMemo(
    () =>
      (events ?? []).filter(
        (e) => (!selectedProjectId || e.projectId === selectedProjectId) && isSameDay(e.startTime, currentDate)
      ),
    [events, selectedProjectId, currentDate]
  );

  const positioned = useMemo(() => layoutEvents(dayEvents), [dayEvents]);

  // Cuántas cosas hay cada día, para las marcas del mes. Se cuenta sobre lo
  // mismo que se ve: con obra elegida, sólo la suya.
  const marcas = useMemo(() => {
    const mapa = new Map<string, DiaMarcado>();
    for (const e of events ?? []) {
      if (selectedProjectId && e.projectId !== selectedProjectId) continue;
      const clave = claveDia(new Date(e.startTime));
      mapa.set(clave, { cuantas: (mapa.get(clave)?.cuantas ?? 0) + 1 });
    }
    return mapa;
  }, [events, selectedProjectId]);

  const now = new Date();
  const isToday = currentDate.toDateString() === now.toDateString();
  const currentTimeTop = now.getHours() * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;

  // Igual que en el móvil del trabajador: 24 horas de rejilla que se abrían
  // arriba del todo obligaban a arrastrar la madrugada vacía para llegar al
  // primer trabajo del día.
  const rejilla = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const caja = rejilla.current;
    if (!caja) return;
    const primero = dayEvents.length ? Math.min(...dayEvents.map((e) => new Date(e.startTime).getHours())) : null;
    const hora = isToday ? new Date().getHours() : (primero ?? 7);
    caja.scrollTop = Math.max(0, (hora - 1) * HOUR_HEIGHT);
  }, [currentDate, dayEvents, isToday]);

  // Un día o un mes, según lo que se esté mirando. Sumar 30 días para "mes
  // siguiente" se desalinearía en febrero y en los meses de 31.
  const mover = (d: Date, pasos: number) => {
    if (vista === "dia") return new Date(d.getTime() + pasos * 86400000);
    const f = new Date(d);
    f.setDate(1);
    f.setMonth(f.getMonth() + pasos);
    return f;
  };

  const openDialogAt = (hour: number) => {
    const d = new Date(currentDate);
    d.setHours(hour, 0, 0, 0);
    setDialogInitialDate(d);
    setDialogOpen(true);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={t("scheduling.title")}
        description={
          selectedProject
            ? t("scheduling.descriptionForProject", { project: selectedProject.name })
            : t("scheduling.description")
        }
      />

      <SelectorDeObra />

      <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate((d) => mover(d, -1))}
               aria-label={vista === "dia" ? t("scheduling.previousDay") : t("scheduling.previousMonth")}>
                <ChevronLeft size={16} />
              </Button>
              <div className="text-sm font-medium text-foreground min-w-[9rem] text-center">
                {vista === "dia"
                  ? currentDate.toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" })
                  : currentDate.toLocaleDateString(i18n.language, { month: "long", year: "numeric" })}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate((d) => mover(d, 1))}
               aria-label={vista === "dia" ? t("scheduling.nextDay") : t("scheduling.nextMonth")}>
                <ChevronRight size={16} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                {t("worker.today")}
              </Button>

              {/* Un mes de un vistazo: para saber si hay algo el jueves que
                  viene no debería hacer falta pulsar la flecha ocho veces. */}
              <div className="flex rounded-lg border border-border overflow-hidden text-sm ml-1">
                {(["dia", "mes"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVista(v)}
                    className={cn(
                      "px-3 min-h-9 transition-colors",
                      vista === v ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"
                    )}
                  >
                    {t(`scheduling.view.${v}`)}
                  </button>
                ))}
              </div>
            </div>
            {/* Una cita cuelga siempre de una obra. Sin obra elegida el botón
                no puede hacer nada, así que en vez de dejarlo muerto se dice
                qué falta y dónde se elige. */}
            <div className="flex items-center gap-3">
              {!selectedProjectId && (
                <span className="text-xs text-muted-foreground">{t("scheduling.pickProjectToAdd")}</span>
              )}
              <Button
                className="gap-2"
                disabled={!selectedProjectId}
                onClick={() => {
                  setDialogInitialDate(new Date(currentDate));
                  setDialogOpen(true);
                }}
              >
                <Plus size={16} /> {t("common.add")}
              </Button>
            </div>
          </div>

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

          {!loading && !error && vista === "mes" && (
            <MonthGrid
              mes={currentDate}
              seleccionado={currentDate}
              marcas={marcas}
              onElegir={(fecha) => {
                // Pulsar un día es querer verlo, no sólo señalarlo.
                setCurrentDate(fecha);
                setVista("dia");
              }}
            />
          )}

          {!loading && !error && vista === "dia" && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div ref={rejilla} className="flex max-h-[70vh] overflow-y-auto">
                {/* Hour rail */}
                <div className="w-14 flex-shrink-0 border-r border-border bg-secondary/40">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} style={{ height: HOUR_HEIGHT }} className="relative text-right pr-2">
                      <span className="text-[10px] text-muted-foreground absolute -top-2 right-2">
                        {String(hour).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* Single day column — one shared view, not split per worker */}
                <div className="flex-1 relative">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={hour}
                      style={{ height: HOUR_HEIGHT }}
                      onClick={() => openDialogAt(hour)}
                      className="border-b border-border/60 hover:bg-secondary/40 transition-colors cursor-pointer"
                    />
                  ))}

                  {isToday && currentTimeTop > 0 && (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-status-error-fg z-20 pointer-events-none"
                      style={{ top: currentTimeTop }}
                    >
                      <div className="w-2 h-2 rounded-full bg-status-error-fg -mt-1 -ml-1" />
                    </div>
                  )}

                  {/* Una rejilla de 24 horas vacía y sin una palabra puede
                      leerse como que todavía está cargando. Un día sin nada es
                      información, y se dice. */}
                  {positioned.length === 0 && (
                    <div className="absolute inset-x-0 top-8 flex justify-center pointer-events-none">
                      <span className="text-xs text-muted-foreground bg-card/90 rounded-md px-3 py-1.5">
                        {t("scheduling.nothingToday")}
                      </span>
                    </div>
                  )}

                  {positioned.map(({ event, lane, laneCount }) => {
                    const start = new Date(event.startTime);
                    const top = start.getHours() * HOUR_HEIGHT + (start.getMinutes() / 60) * HOUR_HEIGHT;
                    const durationMinutes = event.endTime
                      ? (new Date(event.endTime).getTime() - start.getTime()) / 60000
                      : 30;
                    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 20);
                    const detail = blockDetail(height);
                    const widthPct = 100 / laneCount;
                    const isNote = !event.assignedWorkerId;

                    return (
                      <div
                        key={event.id}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "group absolute rounded-lg overflow-hidden z-10 border-l-4",
                          detail.padding,
                          isNote
                            ? "bg-secondary border-dashed border border-muted-foreground/30 border-l-muted-foreground/40"
                            : "shadow-sm"
                        )}
                        style={{
                          top,
                          height,
                          left: `${lane * widthPct}%`,
                          width: `calc(${widthPct}% - 4px)`,
                          ...(isNote
                            ? {}
                            : {
                                backgroundColor: hashColor(event.assignedWorkerId!),
                                borderLeftColor: hashColor(event.assignedWorkerId!),
                              }),
                        }}
                        title={event.notes ?? undefined}
                      >
                        {/* A cancelled visit that cannot be removed leaves a
                            calendar nobody trusts, so every event carries its
                            own delete — revealed on hover so it doesn't
                            compete with reading the day. */}
                        <button
                          aria-label={t("common.delete")}
                          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-status-error-fg"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEvent(event.id, event.kind);
                          }}
                        >
                          <X size={11} strokeWidth={2} />
                        </button>
                        <div className={cn("font-semibold truncate leading-tight flex items-center gap-1 pr-3", detail.text, isNote ? "text-foreground" : "text-foreground")}>
                          {isNote && <StickyNote size={10} className="flex-shrink-0" />}
                          {/* Una orden de trabajo y una cita se pintan en la
                              misma rejilla, así que hace falta saber cuál es
                              cuál sin abrirla. */}
                          {event.kind === "orden" && <ClipboardList size={10} className="flex-shrink-0" />}
                          {event.title}
                        </div>
                        {detail.showSubtitle && (
                          <div className={cn("truncate opacity-80", detail.text)}>
                            {/* Viendo todas las obras, saber quién va no sirve
                                de nada si no se sabe adónde. */}
                            {[
                              !selectedProjectId ? event.projectName : null,
                              isNote ? t(`scheduling.types.${event.type}`, { defaultValue: event.type }) : event.assignedWorkerName,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {selectedProjectId && (
          <ScheduleEventDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            projectId={selectedProjectId}
            initialDate={dialogInitialDate}
            onCreated={() => reload()}
          />
          )}
        </>
    </div>
  );
}
