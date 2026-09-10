import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { WorkerPerformancePanel } from "@/components/WorkerPerformancePanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { MapPin, Check, Clock } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

interface TimeEntry {
  id: string;
  projectName: string | null;
  workerName: string | null;
  checkInTime: string;
  checkInLocation: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLocation: string | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutTime: string | null;
  /** Nulo cuando el trabajador fichó sin decir qué hizo. */
  serviceType: string | null;
  /** De qué trabajo son estas horas, cuando fichó sobre uno de la agenda. */
  jobTitle: string | null;
  approved: boolean;
}

/** El punto donde se pulsó el botón, abrible en un mapa. */
function Punto({ etiqueta, texto, lat, lng }: { etiqueta: string; texto: string | null; lat: number | null; lng: number | null }) {
  const { t } = useTranslation();
  if (lat === null || lng === null) {
    return <span className="text-muted-foreground">{etiqueta}: {texto ?? t("checkIn.noLocation")}</span>;
  }
  return (
    <span>
      {etiqueta}:{" "}
      <a
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-foreground"
        title={t("checkIn.openInMap")}
      >
        {texto}
      </a>
    </span>
  );
}

export default function CheckIn() {
  const { t, i18n } = useTranslation();
  const { data: entries, loading, error } = useApi<TimeEntry[]>("/api/time-entries");
  const [locallyApproved, setLocallyApproved] = useState<Set<string>>(new Set());

  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" }) : null;

  // Approving hours is a payroll decision, so the duration has to be on
  // screen — reading it off two timestamps is the manager's job otherwise.
  const duration = (entry: TimeEntry) => {
    if (!entry.checkOutTime) return null;
    const minutes = Math.round(
      (new Date(entry.checkOutTime).getTime() - new Date(entry.checkInTime).getTime()) / 60000
    );
    if (minutes <= 0) return null;
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
  };

  const approve = async (id: string) => {
    setLocallyApproved((prev) => new Set(prev).add(id));
    try {
      const res = await apiFetch(`/api/time-entries/${id}/approve`, { method: "PATCH" });
      if (!res.ok) throw new Error();
    } catch {
      setLocallyApproved((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={t("checkIn.title")}
        description={t("checkIn.description")}
      />

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">{t("checkIn.title")}</TabsTrigger>
          <TabsTrigger value="performance">{t("performance.title")}</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-4">
          <WorkerPerformancePanel />
        </TabsContent>

        <TabsContent value="entries" className="mt-4">
      <Card className="p-6">
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
            {entries?.map((entry) => {
              const isApproved = entry.approved || locallyApproved.has(entry.id);
              return (
                <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {entry.workerName?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{entry.workerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {/* Dos citas del mismo sitio el mismo día ya no se
                            confunden: se dice cuál era. */}
                        {entry.jobTitle ? `${entry.jobTitle} · ${entry.projectName}` : entry.projectName}
                        {/* Qué se hizo en esas horas. Cuando el trabajador no
                            lo dijo se escribe, en vez de dejar el hueco: un
                            hueco no se distingue de un dato que no se pidió, y
                            aquí la diferencia importa para reclamárselo. */}
                        {" · "}
                        <span className={entry.serviceType ? undefined : "italic"}>
                          {entry.serviceType
                            ? t(`worker.serviceTypes.${entry.serviceType}`, { defaultValue: entry.serviceType })
                            : t("worker.serviceTypes.sin_especificar")}
                        </span>
                      </p>
                      {/* Dónde estaba la persona al fichar, no dónde está la
                          obra: son cosas distintas y esta es la que importa.
                          Se puede elegir una obra y fichar desde cualquier
                          sitio, así que estas coordenadas son la única prueba
                          de dónde se pulsó el botón — y en crudo no le dicen
                          nada a nadie, por eso se abren en el mapa. */}
                      <div className="flex items-start gap-1 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <MapPin size={11} className="flex-shrink-0 mt-0.5" />
                        <Punto etiqueta={t("checkIn.in")} texto={entry.checkInLocation} lat={entry.checkInLat} lng={entry.checkInLng} />
                        {entry.checkOutTime && (
                          <>
                            <span aria-hidden>·</span>
                            <Punto etiqueta={t("checkIn.out")} texto={entry.checkOutLocation} lat={entry.checkOutLat} lng={entry.checkOutLng} />
                          </>
                        )}
                        {/* Las coordenadas abren el punto exacto fuera; esto
                            lleva al mapa del propio producto, que es donde se
                            ve junto al resto de la cuadrilla y con lo que le
                            queda del día. */}
                        {entry.checkInLat !== null && (
                          <>
                            <span aria-hidden>·</span>
                            <Link href={`/gps-routing?entry=${entry.id}`} className="underline hover:text-foreground">
                              {t("gps.openMap")}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{t("checkIn.in")}: {time(entry.checkInTime)}</p>
                      <p>{t("checkIn.out")}: {time(entry.checkOutTime) ?? t("checkIn.inProgress")}</p>
                      {duration(entry) && (
                        <p className="flex items-center justify-end gap-1 text-foreground mt-0.5">
                          <Clock size={11} strokeWidth={1.75} /> {duration(entry)}
                        </p>
                      )}
                    </div>
                    {/* Un fichaje sin salida no tiene horas que aprobar: la
                        nómina cuenta cero mientras la entrada siga abierta. El
                        botón estaba ahí y no hacía nada, así que ahora se dice
                        lo que pasa de verdad —sigue en la obra— y se aprueba
                        cuando fiche la salida. */}
                    {!entry.checkOutTime ? (
                      <StatusBadge tone="info">{t("checkIn.stillOnSite")}</StatusBadge>
                    ) : isApproved ? (
                      <StatusBadge tone="success">{t("checkIn.approved")}</StatusBadge>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => approve(entry.id)}>
                        <Check size={14} /> {t("checkIn.approveHours")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {entries?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("checkIn.noEntries")}</p>
            )}
          </div>
        )}
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
