import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SelectProjectPrompt } from "@/components/SelectProjectPrompt";
import { ScheduleEventDialog } from "@/components/ScheduleEventDialog";
import { ChevronLeft, ChevronRight, Plus, StickyNote, X } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import { useSelectedProject } from "@/contexts/SelectedProjectContext";
import { hashColor, cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface ScheduleEvent {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime: string | null;
  notes: string | null;
  projectId: string | null;
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialDate, setDialogInitialDate] = useState(new Date());

  const removeEvent = async (id: string) => {
    if (!window.confirm(t("scheduling.deleteConfirm"))) return;
    const res = await apiFetch(`/api/schedule-events/${id}`, { method: "DELETE" });
    if (res.ok) reload();
  };

  const dayEvents = useMemo(
    () =>
      (events ?? []).filter((e) => e.projectId === selectedProjectId && isSameDay(e.startTime, currentDate)),
    [events, selectedProjectId, currentDate]
  );

  const positioned = useMemo(() => layoutEvents(dayEvents), [dayEvents]);

  const now = new Date();
  const isToday = currentDate.toDateString() === now.toDateString();
  const currentTimeTop = now.getHours() * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;

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

      {!selectedProjectId && <SelectProjectPrompt />}

      {selectedProjectId && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate((d) => new Date(d.getTime() - 86400000))}
              >
                <ChevronLeft size={16} />
              </Button>
              <div className="text-sm font-medium text-foreground min-w-[9rem] text-center">
                {currentDate.toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" })}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate((d) => new Date(d.getTime() + 86400000))}
              >
                <ChevronRight size={16} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                {t("worker.today")}
              </Button>
            </div>
            <Button
              className="gap-2"
              onClick={() => {
                setDialogInitialDate(new Date(currentDate));
                setDialogOpen(true);
              }}
            >
              <Plus size={16} /> {t("common.add")}
            </Button>
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

          {!loading && !error && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex max-h-[70vh] overflow-y-auto">
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
                            removeEvent(event.id);
                          }}
                        >
                          <X size={11} strokeWidth={2} />
                        </button>
                        <div className={cn("font-semibold truncate leading-tight flex items-center gap-1 pr-3", detail.text, isNote ? "text-foreground" : "text-foreground")}>
                          {isNote && <StickyNote size={10} className="flex-shrink-0" />}
                          {event.title}
                        </div>
                        {detail.showSubtitle && (
                          <div className={cn("truncate opacity-80", detail.text)}>
                            {isNote ? t(`scheduling.types.${event.type}`, { defaultValue: event.type }) : event.assignedWorkerName}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <ScheduleEventDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            projectId={selectedProjectId}
            initialDate={dialogInitialDate}
            onCreated={() => reload()}
          />
        </>
      )}
    </div>
  );
}
