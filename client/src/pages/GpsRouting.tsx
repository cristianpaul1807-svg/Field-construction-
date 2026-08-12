import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { MapPin } from "lucide-react";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface ActiveWorker {
  id: string;
  name: string;
  kind: "employee" | "subcontractor";
  currentProject: string | null;
}

export default function GpsRouting() {
  const { t } = useTranslation();
  const { data: active, loading, error } = useApi<ActiveWorker[]>("/api/gps");

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={t("gps.title")}
        description={t("gps.description")}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="h-96 bg-secondary flex flex-col items-center justify-center gap-2 text-center px-6">
            <MapPin size={28} className="text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t("gps.mapWaiting")}</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Se conectará con Google Maps API (o Mapbox) cuando el negocio configure su clave.
              Por ahora este es un placeholder visual.
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-foreground mb-3 text-sm">{t("gps.activeNow")}</h3>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner className="size-4" /> Cargando...
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-border bg-status-error-bg/40 p-3 text-xs text-status-error-fg">
              No se pudo cargar: {error}
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-3">
              {active?.map((worker) => (
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
                    {worker.kind === "employee" ? "En ruta" : "Subcontratista"}
                  </StatusBadge>
                </div>
              ))}
              {active?.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("gps.nobodyActive")}</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
