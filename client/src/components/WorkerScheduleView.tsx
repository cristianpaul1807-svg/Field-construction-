import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { hashColor, cn } from "@/lib/utils";
import { workerApiFetch } from "@/lib/workerSession";

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
  const [view, setView] = useState<"dia" | "semana">("dia");
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

  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000)), [weekStart]);

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
          <Button variant="outline" size="icon" onClick={() => setCurrentDate((d) => new Date(d.getTime() - (view === "dia" ? 86400000 : 7 * 86400000)))}>
            <ChevronLeft size={16} />
          </Button>
          <div className="text-sm font-medium text-foreground min-w-[8rem] text-center">
            {view === "dia"
              ? currentDate.toLocaleDateString(i18n.language, { day: "numeric", month: "long" })
              : t("worker.weekOf", {
                  date: weekStart.toLocaleDateString(i18n.language, { day: "numeric", month: "short" }),
                })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate((d) => new Date(d.getTime() + (view === "dia" ? 86400000 : 7 * 86400000)))}>
            <ChevronRight size={16} />
          </Button>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          <button
            onClick={() => setView("dia")}
            className={cn("px-3 py-1.5 transition-colors", view === "dia" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary")}
          >
            {t("worker.today")}
          </button>
          <button
            onClick={() => setView("semana")}
            className={cn("px-3 py-1.5 transition-colors", view === "semana" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary")}
          >
            {t("worker.week")}
          </button>
        </div>
      </div>

      {view === "dia" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex max-h-[55vh] overflow-y-auto">
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

      {view === "semana" && (
        <div className="space-y-2">
          {weekDays.map((day) => {
            const items = (events ?? []).filter((e) => isSameDay(e.startTime, day));
            return (
              <div key={day.toISOString()} className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  {day.toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "short" })}
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
              </div>
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
                <span className={cn("text-xs font-medium flex-shrink-0", priorityTone[w.priority])}>{w.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
