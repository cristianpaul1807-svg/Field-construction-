import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Clock, MapPin, RefreshCw, Calendar, CheckCircle2, History } from "lucide-react";
import { workerApiFetch } from "@/lib/workerSession";

interface ActiveEntry {
  id: string;
  projectId: string;
  projectName: string | null;
  checkInTime: string;
  serviceType: string | null;
}

/** Una opción del desplegable: o un trabajo concreto de hoy, o una obra suelta. */
interface Opcion {
  /** Identifica la opción, no la obra: dos trabajos del mismo sitio son dos. */
  key: string;
  projectId: string;
  name: string;
  hoy: boolean;
  /** El título del trabajo de hoy, cuando lo hay. */
  tarea: string | null;
  /** Un trabajo de hoy viene de la agenda o de una orden, nunca de las dos. */
  scheduleEventId: string | null;
  workOrderId: string | null;
  /** Lo que la oficina dijo que era este trabajo, si lo dijo. */
  serviceType: string | null;
}

interface TimeHistoryEntry {
  id: string;
  projectId: string;
  projectName: string | null;
  checkInTime: string;
  checkOutTime: string;
  checkInLocation: string | null;
  checkOutLocation: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  serviceType: string | null;
  overtime: boolean;
}

const SERVICE_TYPES = ["instalacion", "mantenimiento", "reparacion", "inspeccion", "otro"] as const;

/** Radix no admite un SelectItem con valor vacío, así que "no lo he dicho"
 *  necesita un valor propio en la pantalla. A la base sigue yendo nulo. */
const SIN_ESPECIFICAR = "sin_especificar";

function formatHours(ms: number) {
  const hours = ms / 3_600_000;
  const hrs = Math.floor(hours);
  const mins = Math.round((hours - hrs) * 60);
  if (hrs === 0) return `${mins} min`;
  return `${hrs}h ${mins}m`;
}

function getLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("NO_GEOLOCATION"));
      return;
    }
    // Force maximumAge: 0 to acquire a fresh, real-time GPS coordinate on every single call
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => reject(new Error("locationDenied")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

export function WorkerClock() {
  const { t, i18n } = useTranslation();
  const [active, setActive] = useState<ActiveEntry | null | undefined>(undefined);
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [history, setHistory] = useState<TimeHistoryEntry[]>([]);
  const [elegida, setElegida] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [switching, setSwitching] = useState(false);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [busy, setBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const load = () => {
    workerApiFetch("/api/worker/time-entries/active")
      .then((res) => res.json())
      .then(setActive);
    // El desfase del móvil va en la pregunta: "lo de hoy" tiene que ser el hoy
    // de quien está mirando la pantalla, y el servidor corre en UTC.
    workerApiFetch(`/api/worker/projects?tzOffset=${new Date().getTimezoneOffset()}`)
      .then((res) => res.json())
      .then((d) => setOpciones(Array.isArray(d) ? d : []));
    workerApiFetch("/api/worker/time-entries/history")
      .then((res) => res.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []));
  };

  useEffect(load, []);

  const hoy = opciones.filter((o) => o.hoy);
  const otras = opciones.filter((o) => !o.hoy);
  const trabajo = opciones.find((o) => o.key === elegida) ?? null;

  /** Lo que se guarda: nulo cuando no lo ha dicho. El servidor rellena
   *  entonces con lo que la oficina puso al programar el trabajo. */
  const tipoElegido = () => (serviceType && serviceType !== SIN_ESPECIFICAR ? serviceType : null);

  // Al elegir un trabajo que ya viene clasificado desde la oficina, el
  // desplegable se pone solo en eso: el trabajador no tiene que repetir lo que
  // ya se sabe, y si el día se tuerce puede cambiarlo.
  //
  // Y al cambiar a otro trabajo se vuelve a lo que diga ese: si no se limpia,
  // el tipo del anterior se queda pegado y las horas de un trabajo sin
  // clasificar acaban etiquetadas con lo que era el de antes.
  useEffect(() => {
    setServiceType(trabajo?.serviceType ?? "");
  }, [trabajo?.key]);

  // Update current clock time every minute for continuous calculation
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const withLocation = async (action: (loc: { latitude: number; longitude: number }) => Promise<void>) => {
    setLocationError(null);
    setBusy(true);
    try {
      const loc = await getLocation();
      await action(loc);
    } catch (err) {
      if (err instanceof Error && err.message === "locationDenied") {
        setLocationError(t("worker.locationNeeded"));
      } else {
        setLocationError(err instanceof Error ? err.message : t("worker.locationError"));
      }
    } finally {
      setBusy(false);
    }
  };

  const checkIn = () =>
    withLocation(async (loc) => {
      await workerApiFetch("/api/worker/time-entries/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: trabajo?.projectId,
          scheduleEventId: trabajo?.scheduleEventId ?? null,
          workOrderId: trabajo?.workOrderId ?? null,
          serviceType: tipoElegido(),
          ...loc,
        }),
      });
      load();
    });

  const checkOut = () =>
    withLocation(async (loc) => {
      await workerApiFetch(`/api/worker/time-entries/${active!.id}/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loc),
      });
      setActive(null);
      load();
    });

  const confirmSwitch = () =>
    withLocation(async (loc) => {
      await workerApiFetch("/api/worker/time-entries/switch-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeEntryId: active!.id,
          projectId: trabajo?.projectId,
          scheduleEventId: trabajo?.scheduleEventId ?? null,
          workOrderId: trabajo?.workOrderId ?? null,
          serviceType: tipoElegido(),
          ...loc,
        }),
      });
      setSwitching(false);
      load();
    });

  if (active === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("common.loading")}
      </div>
    );
  }

  // Calculate shift duration and hours breakdown (8h regular vs overtime)
  const shiftStartMs = active ? new Date(active.checkInTime).getTime() : 0;
  const elapsedMs = active ? Math.max(0, nowMs - shiftStartMs) : 0;
  const elapsedTotalHours = elapsedMs / 3_600_000;
  const regularHours = Math.min(8.0, elapsedTotalHours);
  const overtimeHours = Math.max(0.0, elapsedTotalHours - 8.0);

  // Nadie trabaja un turno de dieciséis horas seguidas: pasado ese punto, lo
  // que hay no es una jornada larga sino una salida sin fichar del viernes. El
  // contador seguía sumando y le enseñaba a Carlos "1016 h, de ellas 1008 de
  // horas extra". La nómina no lo cobra —una entrada sin salida cuenta cero—,
  // pero un reloj que dice un disparate deja de ser un reloj en el que fiar.
  const OLVIDADO_H = 16;
  const turnoOlvidado = elapsedTotalHours > OLVIDADO_H;

  return (
    <div className="space-y-6">
      {/* Shift Summary Card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground text-sm">{t("worker.shiftSummary")}</h2>
          </div>
          {active && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t("worker.onSiteSince", {
                project: active.projectName ?? t("worker.unnamedProject"),
                time: new Date(active.checkInTime).toLocaleTimeString(i18n.language, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </span>
          )}
        </div>

        {active ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{t("worker.checkInTimeLabel")}</p>
                <p className="text-lg font-bold text-foreground">
                  {new Date(active.checkInTime).toLocaleTimeString(i18n.language, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{t("worker.checkOutTimeLabel")}</p>
                <p className="text-lg font-bold text-primary">
                  {new Date(nowMs).toLocaleTimeString(i18n.language, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {/* Time calculation & Hours breakdown */}
            {turnoOlvidado ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {t("worker.forgottenShiftTitle")}
                </p>
                <p className="text-xs text-amber-700/90 dark:text-amber-300/90">
                  {t("worker.forgottenShiftBody", {
                    since: new Date(active.checkInTime).toLocaleString(i18n.language, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/80 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("worker.calculatedDuration")}:</span>
                  <span className="font-bold text-foreground text-base">{formatHours(elapsedMs)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">{t("worker.regularHours")}</span>
                    <span className="font-semibold text-foreground">{regularHours.toFixed(1)} hrs</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">{t("worker.overtimeHours")}</span>
                    <span className={`font-semibold ${overtimeHours > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground"}`}>
                      {overtimeHours.toFixed(1)} hrs
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">{t("worker.noActiveEntry")}</p>
        )}
      </div>

      {locationError && (
        <div className="rounded-lg border border-status-error-bg bg-status-error-bg/40 p-3 text-sm text-status-error-fg flex items-center gap-2">
          <MapPin size={14} className="flex-shrink-0" /> {locationError}
        </div>
      )}

      {/* Entry Actions & Project Selector */}
      {!active || switching ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("common.project")}</Label>
            {opciones.length === 0 ? (
              // Sin obras asignadas el desplegable se abría vacío y el botón de
              // fichar no llevaba a ninguna parte: desde el andamio eso se lee
              // como que la aplicación está rota, no como que falta un paso en
              // la oficina.
              <p className="text-sm text-muted-foreground rounded-lg border border-border bg-secondary/40 p-3">
                {t("worker.noProjectsAssigned")}
              </p>
            ) : (
              <Select value={elegida} onValueChange={setElegida}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("worker.selectProject")} />
                </SelectTrigger>
                <SelectContent>
                  {/* Lo de hoy arriba y con su título: el trabajador reconoce
                      "Instalar cableado planta 3" antes que el nombre de la
                      obra, y es lo que va a pulsar casi siempre. Las demás
                      siguen debajo porque hay negocios que no usan la agenda,
                      y filtrar por hoy a secas los dejaría sin fichar. */}
                  {hoy.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{t("worker.todaysJobs")}</SelectLabel>
                      {hoy.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.tarea ? `${o.tarea} · ${o.name}` : o.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {otras.length > 0 && (
                    <SelectGroup>
                      {hoy.length > 0 && <SelectLabel>{t("worker.otherProjects")}</SelectLabel>}
                      {otras.map((o) => (
                        <SelectItem key={o.key} value={o.key}>{o.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* "Facturable" se lo preguntábamos al obrero y no lo leía nadie:
              ni la nómina, ni los costes, ni las facturas. Decidir si una hora
              se cobra es de la oficina, y la columna sigue ahí con su valor
              por defecto para cuando el panel sepa usarla.

              El tipo de servicio se queda, y sin obligar: nace sin elegir, y
              si el trabajador no lo toca el fichaje entra igual y en el panel
              se ve "sin especificar". Así se sabe que trabajó y que no dijo
              qué hizo, en vez de bloquearle el fichaje a pie de obra. */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              {t("worker.serviceType")}{" "}
              <span className="font-normal text-muted-foreground">{t("worker.optional")}</span>
            </Label>
            <Select value={serviceType || SIN_ESPECIFICAR} onValueChange={setServiceType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_ESPECIFICAR}>{t("worker.serviceTypes.sin_especificar")}</SelectItem>
                {SERVICE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{t(`worker.serviceTypes.${type}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {switching ? (
            <div className="flex gap-2">
              <Button className="flex-1" size="lg" onClick={confirmSwitch} disabled={!trabajo || busy}>
                {busy ? <Spinner className="size-4" /> : t("worker.confirmSwitch")}
              </Button>
              <Button variant="outline" size="lg" onClick={() => setSwitching(false)}>{t("common.cancel")}</Button>
            </div>
          ) : (
            <Button className="w-full gap-2" size="lg" onClick={checkIn} disabled={!trabajo || busy}>
              {busy ? <Spinner className="size-4" /> : <><MapPin size={16} /> {t("worker.clockIn")}</>}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button className="w-full gap-2 py-6 text-base font-semibold" size="lg" variant="destructive" onClick={checkOut} disabled={busy}>
            {busy ? (
              <span className="flex items-center gap-2">
                <Spinner className="size-4" /> {t("worker.finalizingShift")}
              </span>
            ) : (
              <>
                <MapPin size={18} /> {t("worker.clockOut")}
              </>
            )}
          </Button>
          <Button className="w-full gap-2" size="lg" variant="outline" onClick={() => setSwitching(true)} disabled={busy}>
            <RefreshCw size={16} /> {t("worker.switchProject")}
          </Button>
        </div>
      )}

      {/* Timeclock History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground border-b border-border pb-2">
            <History size={14} />
            <span>{t("worker.historyTitle")}</span>
          </div>
          <div className="space-y-2">
            {history.map((item) => {
              const start = new Date(item.checkInTime);
              const end = new Date(item.checkOutTime);
              const durMs = Math.max(0, end.getTime() - start.getTime());
              const dateStr = start.toLocaleDateString(i18n.language, { month: "short", day: "numeric" });
              const startTimeStr = start.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });
              const endTimeStr = end.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });

              return (
                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground">{item.projectName ?? t("worker.unnamedProject")}</p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Calendar size={11} /> {dateStr}: {startTimeStr} – {endTimeStr}
                    </p>
                    {(item.checkInLocation || item.checkOutLocation) && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin size={10} className="text-emerald-500" />
                        {item.checkInLocation} → {item.checkOutLocation ?? "OK"}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-foreground block">{formatHours(durMs)}</span>
                    {item.overtime && (
                      <span className="inline-block px-1.5 py-0.5 text-[10px] rounded font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        +Overtime
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
