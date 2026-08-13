import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { TileMap, type MapPoint } from "@/components/TileMap";
import { MapPin } from "lucide-react";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface ActiveWorker {
  id: string;
  name: string;
  kind: "employee" | "subcontractor";
  currentProject: string | null;
}

interface ScheduledJob {
  id: string;
  title: string;
  projectName: string | null;
  startTime: string;
  endTime: string;
  late: boolean;
  done: boolean;
}

interface CheckInLocation {
  id: string;
  workerId: string | null;
  name: string | null;
  projectName: string | null;
  serviceType: string | null;
  lat: number;
  lng: number;
  checkInTime: string;
  checkOutTime: string | null;
  stillOnSite: boolean;
  schedule: ScheduledJob[];
  late: boolean;
}

/** hh:mm since the check-in, recomputed on render — good enough for a panel
 *  somebody glances at, and one less timer running all day. */
function elapsed(fromIso: string, toIso: string | null) {
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

interface GpsResponse {
  workers: ActiveWorker[];
  locations: CheckInLocation[];
}

export default function GpsRouting() {
  const { t, i18n } = useTranslation();
  const { data, loading, error } = useApi<GpsResponse>("/api/gps");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active = data?.workers ?? [];
  const locations = data?.locations ?? [];

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });

  const points: MapPoint[] = locations.map((l) => ({
    id: l.id,
    lat: l.lat,
    lng: l.lng,
    label: l.name ?? "—",
    sublabel: [l.projectName, time(l.checkInTime)].filter(Boolean).join(" · "),
    // Someone who already checked out is history, not a live position; someone
    // late is the one thing on this screen worth spotting without tapping.
    tone: !l.stillOnSite ? "muted" : l.late ? "warning" : "primary",
    emoji: l.stillOnSite ? "👷" : "📍",
  }));

  const selected = locations.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader title={t("gps.title")} description={t("gps.description")} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-0 overflow-hidden gap-0">
          {points.length > 0 ? (
            <TileMap points={points} className="h-96 lg:h-auto lg:flex-1 lg:min-h-96" selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <div className="h-96 lg:h-auto lg:flex-1 lg:min-h-96 bg-secondary flex flex-col items-center justify-center gap-2 text-center px-6">
              <MapPin size={28} className="text-muted-foreground" strokeWidth={1.5} />
              <p className="text-sm font-medium text-foreground">{t("gps.noLocations")}</p>
              <p className="text-xs text-muted-foreground max-w-xs">{t("gps.noLocationsHint")}</p>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          {/* Tapping a hard hat answers the three questions a supervisor
              actually has: what are they on, how long have they been on it,
              and what is still waiting for them today. */}
          {selected && (
            <Card className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{selected.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selected.projectName ?? t("gps.noProject")}
                    {selected.serviceType ? ` · ${t(`worker.serviceTypes.${selected.serviceType}`, { defaultValue: selected.serviceType })}` : ""}
                  </p>
                </div>
                <StatusBadge tone={!selected.stillOnSite ? "neutral" : selected.late ? "warning" : "success"}>
                  {!selected.stillOnSite ? t("gps.checkedOut") : selected.late ? t("gps.runningLate") : t("gps.onSite")}
                </StatusBadge>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t("gps.elapsed")}</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">
                    {elapsed(selected.checkInTime, selected.checkOutTime)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("gps.since")}</p>
                  <p className="text-sm text-foreground">{time(selected.checkInTime)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">{t("gps.todaysJobs")}</p>
                {selected.schedule.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("gps.nothingScheduled")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {selected.schedule.map((job) => (
                      <li key={job.id} className="flex items-start justify-between gap-2">
                        <span
                          className={
                            job.done
                              ? "text-xs text-muted-foreground line-through min-w-0 truncate"
                              : "text-xs text-foreground min-w-0 truncate"
                          }
                        >
                          {job.title}
                          {job.projectName ? ` · ${job.projectName}` : ""}
                        </span>
                        <span
                          className={
                            job.late
                              ? "text-xs text-status-warning-fg flex-shrink-0"
                              : "text-xs text-muted-foreground flex-shrink-0"
                          }
                        >
                          {time(job.startTime)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-3 text-sm">{t("gps.activeNow")}</h3>

            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Spinner className="size-4" /> {t("common.loading")}
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-border bg-status-error-bg/40 p-3 text-xs text-status-error-fg">
                {t("common.loadError", { message: error })}
              </div>
            )}

            {!loading && !error && (
              <div className="space-y-3">
                {active.map((worker) => (
                  <div key={worker.id} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                        worker.kind === "employee" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                      }`}
                    >
                      {worker.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{worker.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{worker.currentProject ?? "—"}</p>
                    </div>
                    <StatusBadge tone={worker.kind === "employee" ? "success" : "info"}>
                      {worker.kind === "employee" ? t("gps.onRoute") : t("materials.categorySubcontractors")}
                    </StatusBadge>
                  </div>
                ))}
                {active.length === 0 && <p className="text-xs text-muted-foreground">{t("gps.nobodyActive")}</p>}
              </div>
            )}
          </Card>

          {locations.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-foreground mb-3 text-sm">{t("gps.recentCheckIns")}</h3>
              <div className="space-y-3">
                {locations.slice(0, 8).map((l) => (
                  <div key={l.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{l.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[l.projectName, time(l.checkInTime)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <a
                      className="text-xs text-primary hover:underline flex-shrink-0"
                      href={`https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lng}#map=17/${l.lat}/${l.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("gps.openMap")}
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
