import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Clock, MapPin, RefreshCw } from "lucide-react";
import { workerApiFetch } from "@/lib/workerSession";

interface ActiveEntry {
  id: string;
  projectId: string;
  projectName: string | null;
  checkInTime: string;
  billable: boolean;
  serviceType: string | null;
}

interface Project {
  id: string;
  name: string;
}

const SERVICE_TYPES = ["instalacion", "mantenimiento", "reparacion", "inspeccion", "otro"] as const;

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function getLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("NO_GEOLOCATION"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => reject(new Error("locationDenied")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export function WorkerClock() {
  const { t } = useTranslation();
  const [active, setActive] = useState<ActiveEntry | null | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [billable, setBillable] = useState(true);
  const [serviceType, setServiceType] = useState("");
  const [switching, setSwitching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const load = () => {
    workerApiFetch("/api/worker/time-entries/active")
      .then((res) => res.json())
      .then(setActive);
    workerApiFetch("/api/worker/projects")
      .then((res) => res.json())
      .then(setProjects);
  };

  useEffect(load, []);

  useEffect(() => {
    if (!active) return;
    const tick = () => setElapsed(Date.now() - new Date(active.checkInTime).getTime());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [active]);

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
        body: JSON.stringify({ projectId, billable, serviceType: serviceType || null, ...loc }),
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
    });

  const confirmSwitch = () =>
    withLocation(async (loc) => {
      await workerApiFetch("/api/worker/time-entries/switch-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeEntryId: active!.id,
          projectId,
          billable,
          serviceType: serviceType || null,
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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
        <Clock size={20} className="mx-auto text-muted-foreground" />
        <div className="text-4xl font-bold text-foreground tabular-nums">
          {active ? formatElapsed(elapsed) : "00:00:00"}
        </div>
        {active ? (
          <p className="text-sm text-muted-foreground">
            En {active.projectName ?? "proyecto"} desde{" "}
            {new Date(active.checkInTime).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("worker.noActiveEntry")}</p>
        )}
      </div>

      {locationError && (
        <div className="rounded-lg border border-status-error-bg bg-status-error-bg/40 p-3 text-sm text-status-error-fg flex items-center gap-2">
          <MapPin size={14} className="flex-shrink-0" /> {locationError}
        </div>
      )}

      {!active || switching ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("common.project")}</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Facturable</Label>
              <Select value={billable ? "si" : "no"} onValueChange={(v) => setBillable(v === "si")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">{t("common.yes")}</SelectItem>
                  <SelectItem value="no">{t("common.no")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("worker.serviceType")}</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{t(`worker.serviceTypes.${type}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {switching ? (
            <div className="flex gap-2">
              <Button className="flex-1" size="lg" onClick={confirmSwitch} disabled={!projectId || busy}>
                Confirmar cambio
              </Button>
              <Button variant="outline" size="lg" onClick={() => setSwitching(false)}>{t("common.cancel")}</Button>
            </div>
          ) : (
            <Button className="w-full gap-2" size="lg" onClick={checkIn} disabled={!projectId || busy}>
              <MapPin size={16} /> Marcar entrada
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button className="w-full gap-2" size="lg" variant="destructive" onClick={checkOut} disabled={busy}>
            <MapPin size={16} /> Marcar salida
          </Button>
          <Button className="w-full gap-2" size="lg" variant="outline" onClick={() => setSwitching(true)} disabled={busy}>
            <RefreshCw size={16} /> Cambiar de proyecto
          </Button>
        </div>
      )}
    </div>
  );
}
