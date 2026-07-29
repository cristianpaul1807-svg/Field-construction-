import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { useApi } from "@/lib/api";

const typeTone = {
  visita: "info",
  llamada: "neutral",
  reunion: "warning",
  inicio: "success",
  fin: "error",
} as const;

const typeLabel = { visita: "Visita", llamada: "Llamada", reunion: "Reunión", inicio: "Inicio de obra", fin: "Entrega" };

const views = ["Día", "Semana", "Mes"] as const;

interface ScheduleEvent {
  id: string;
  title: string;
  type: keyof typeof typeLabel;
  startTime: string;
  projectName: string | null;
}

export default function Scheduling() {
  const { data: events, loading, error } = useApi<ScheduleEvent[]>("/api/schedule-events");
  const [view, setView] = useState<(typeof views)[number]>("Semana");

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Scheduling"
        description="Visitas, citas, inicios de obra y fechas de entrega"
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Plus size={16} /> New Event
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${view === v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:bg-secondary"}`}
          >
            {v}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-2">
          Sincronización bidireccional con Google Calendar en Fase B/C
        </span>
      </div>

      <Card className="p-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Cargando agenda...
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
            No se pudo cargar desde Supabase: {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-3">
            {events?.map((event) => (
              <div key={event.id} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
                <div className="w-24 text-center flex-shrink-0">
                  <p className="text-xs text-muted-foreground">{event.startTime?.slice(5, 10)}</p>
                  <p className="text-sm font-semibold text-foreground">{event.startTime?.slice(11, 16)}</p>
                </div>
                <CalendarIcon size={16} className="text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  {event.projectName && <p className="text-xs text-muted-foreground">{event.projectName}</p>}
                </div>
                <StatusBadge tone={typeTone[event.type]}>{typeLabel[event.type]}</StatusBadge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
