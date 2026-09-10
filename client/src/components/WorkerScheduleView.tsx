import { useTranslation } from "react-i18next";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { hashColor, cn } from "@/lib/utils";
import { workerApiFetch } from "@/lib/workerSession";
import { MonthGrid, claveDia, type DiaMarcado } from "@/components/MonthGrid";

interface ScheduleEvent {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime: string | null;
  notes: string | null;
  projectId: string | null;
  projectName: string | null;
}

interface WorkOrder {
  id: string;
  title: string;
  description: string | null;
  priority: "baja" | "media" | "alta";
  status: string;
  projectId: string | null;
  projectName: string | null;
}

const HOUR_HEIGHT = 56;

function isSameDay(iso: string, date: Date) {
  const d = new Date(iso);
  return d.toDateString() === date.toDateString();
}

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

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

const priorityTone: Record<string, string> = {
  alta: "text-status-error-fg",
  media: "text-status-warning-fg",
  baja: "text-muted-foreground",
};

export function WorkerScheduleView() {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState<ScheduleEvent[] | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"dia" | "semana" | "mes">("dia");
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    workerApiFetch("/api/worker/schedule")
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        setEvents(body.events ?? []);
        setWorkOrders(body.workOrders ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const dayEvents = useMemo(() => (events ?? []).filter((e) => isSameDay(e.startTime, currentDate)), [events, currentDate]);
  const positioned = useMemo(() => layoutEvents(dayEvents), [dayEvents]);

  const now = new Date();
  const isToday = currentDate.toDateString() === now.toDateString();
  const currentTimeTop = now.getHours() * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;

  // La rejilla del día son 24 horas y se abría arriba del todo: el trabajador
  // veía la madrugada vacía y tenía que arrastrar seis horas de noche para
  // llegar a su primer trabajo. Se coloca sola donde está el día: en la hora
  // actual si es hoy, si no en el primer evento, y si no hay nada, a las siete.
  const rejilla = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const caja = rejilla.current;
    if (!caja || view !== "dia") return;
    const primero = dayEvents.length
      ? Math.min(...dayEvents.map((e) => new Date(e.startTime).getHours()))
      : null;
    const hora = isToday ? new Date().getHours() : (primero ?? 7);
    // Una hora de margen por arriba, para que se vea que hay algo antes.
    caja.scrollTop = Math.max(0, (hora - 1) * HOUR_HEIGHT);
  }, [view, currentDate, dayEvents, isToday]);

  // Los días con algo, para las marcas del mes.
  const marcas = useMemo(() => {
    const mapa = new Map<string, DiaMarcado>();
    for (const e of events ?? []) {
      const clave = claveDia(new Date(e.startTime));
      mapa.set(clave, { cuantas: (mapa.get(clave)?.cuantas ?? 0) + 1 });
    }
    return mapa;
  }, [events]);

  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000)), [weekStart]);

  // Un día, una semana o un mes, según lo que se esté mirando.
  const mover = (d: Date, pasos: number) => {
    if (view === "dia") return new Date(d.getTime() + pasos * 86400000);
    if (view === "semana") return new Date(d.getTime() + pasos * 7 * 86400000);
    const f = new Date(d);
    f.setDate(1);
    f.setMonth(f.getMonth() + pasos);
    return f;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate((d) => mover(d, -1))} aria-label={t(view === "dia" ? "scheduling.previousDay" : view === "semana" ? "scheduling.previousWeek" : "scheduling.previousMonth")}>
            <ChevronLeft size={16} />
          </Button>
          <div className="text-sm font-medium text-foreground min-w-[8rem] text-center">
            {view === "mes"
              ? currentDate.toLocaleDateString(i18n.language, { month: "long", year: "numeric" })
              : view === "dia"
              ? currentDate.toLocaleDateString(i18n.language, { day: "numeric", month: "long" })
              : t("worker.weekOf", {
                  date: weekStart.toLocaleDateString(i18n.language, { day: "numeric", month: "short" }),
                })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate((d) => mover(d, 1))} aria-label={t(view === "dia" ? "scheduling.nextDay" : view === "semana" ? "scheduling.nextWeek" : "scheduling.nextMonth")}>
            <ChevronRight size={16} />
          </Button>
          {/* Sin esto, quien se va tres meses adelante vuelve a hoy a base de
              flechas. Sólo aparece cuando hace falta. */}
          {!isToday && (
            <Button variant="outline" size="sm" className="min-h-11" onClick={() => setCurrentDate(new Date())}>
              {t("worker.today")}
            </Button>
          )}
        </div>
        {/* Día/Semana también se tocan con guantes: alto de dedo, no de ratón. */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          <button
            onClick={() => setView("dia")}
            className={cn("px-4 min-h-11 transition-colors", view === "dia" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary")}
          >
            {t("scheduling.view.dia")}
          </button>
          <button
            onClick={() => setView("semana")}
            className={cn("px-4 min-h-11 transition-colors", view === "semana" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary")}
          >
            {t("worker.week")}
          </button>
          <button
            onClick={() => setView("mes")}
            className={cn("px-4 min-h-11 transition-colors", view === "mes" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary")}
          >
            {t("scheduling.view.mes")}
          </button>
        </div>
      </div>

      {view === "mes" && (
        <MonthGrid
          mes={currentDate}
          seleccionado={currentDate}
          marcas={marcas}
          onElegir={(fecha) => {
            setCurrentDate(fecha);
            setView("dia");
          }}
        />
      )}

      {view === "dia" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div ref={rejilla} className="flex max-h-[55vh] overflow-y-auto">
            <div className="w-12 flex-shrink-0 border-r border-border bg-secondary/40">
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} style={{ height: HOUR_HEIGHT }} className="relative text-right pr-1.5">
                  <span className="text-[9px] text-muted-foreground absolute -top-1.5 right-1.5">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>
            <div className="flex-1 relative">
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-b border-border/60" />
              ))}
              {isToday && (
                <div className="absolute left-0 right-0 border-t-2 border-status-error-fg z-20 pointer-events-none" style={{ top: currentTimeTop }}>
                  <div className="w-2 h-2 rounded-full bg-status-error-fg -mt-1 -ml-1" />
                </div>
              )}
              {positioned.map(({ event, lane, laneCount }) => {
                const start = new Date(event.startTime);
                const top = start.getHours() * HOUR_HEIGHT + (start.getMinutes() / 60) * HOUR_HEIGHT;
                const durationMinutes = event.endTime ? (new Date(event.endTime).getTime() - start.getTime()) / 60000 : 30;
                const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 18);
                const widthPct = 100 / laneCount;
                const color = hashColor(event.projectId ?? event.id);
                return (
                  <div
                    key={event.id}
                    className="absolute rounded-lg overflow-hidden z-10 border-l-4 shadow-sm px-2 py-1"
                    style={{
                      top,
                      height,
                      left: `${lane * widthPct}%`,
                      width: `calc(${widthPct}% - 4px)`,
                      backgroundColor: color,
                      borderLeftColor: color,
                    }}
                    title={event.notes ?? undefined}
                  >
                    <div className="font-semibold truncate leading-tight text-[11px] text-foreground">{event.title}</div>
                    {height > 32 && <div className="truncate opacity-80 text-[10px]">{event.projectName}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* La semana entera es la respuesta a "¿qué me toca esta semana?", pero
          también es el camino a un día concreto: cada día se pulsa y se entra
          en él. Los días sin nada se apagan en vez de ocupar lo mismo que los
          llenos, que era lo que obligaba a leer siete tarjetas para encontrar
          las dos que importan. */}
      {view === "semana" && (
        <div className="space-y-2">
          {weekDays.map((day) => {
            const items = (events ?? []).filter((e) => isSameDay(e.startTime, day));
            const esHoy = day.toDateString() === now.toDateString();
            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  setCurrentDate(day);
                  setView("dia");
                }}
                aria-label={`${day.toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long" })} — ${
                  items.length ? t("scheduling.countThatDay", { count: items.length }) : t("worker.noJobsAssigned")
                }`}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-colors hover:bg-secondary",
                  esHoy ? "border-primary" : "border-border",
                  items.length ? "bg-card" : "bg-card/50"
                )}
              >
                <p className="flex items-center gap-2 text-xs font-semibold uppercase mb-2">
                  <span className={cn(items.length ? "text-foreground" : "text-muted-foreground")}>
                    {day.toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "short" })}
                  </span>
                  {items.length > 0 && (
                    <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] leading-none">
                      {items.length}
                    </span>
                  )}
                </p>
                {items.length === 0 && <p className="text-xs text-muted-foreground">{t("worker.noJobsAssigned")}</p>}
                <div className="space-y-1.5">
                  {items.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 text-sm">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: hashColor(e.projectId ?? e.id) }}
                      />
                      <span className="text-muted-foreground text-xs w-12 flex-shrink-0">
                        {new Date(e.startTime).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-foreground truncate">{e.title}</span>
                      {e.projectName && <span className="text-xs text-muted-foreground truncate">· {e.projectName}</span>}
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {(workOrders ?? []).length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList size={15} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">{t("worker.pendingWorkOrders")}</h3>
          </div>
          <div className="space-y-2">
            {workOrders!.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <p className="text-foreground truncate">{w.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{w.projectName}</p>
                </div>
                <span className={cn("text-xs font-medium flex-shrink-0", priorityTone[w.priority])}>
                  {t(`workOrders.priorities.${w.priority}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
