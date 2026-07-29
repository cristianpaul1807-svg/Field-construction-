import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { scheduleEvents, findProject } from "@/lib/mockData";

const typeTone = {
  visita: "info",
  llamada: "neutral",
  reunion: "warning",
  inicio: "success",
  fin: "error",
} as const;

const typeLabel = { visita: "Visita", llamada: "Llamada", reunion: "Reunión", inicio: "Inicio de obra", fin: "Entrega" };

const views = ["Día", "Semana", "Mes"] as const;

export default function Scheduling() {
  const [view, setView] = useState<(typeof views)[number]>("Semana");
  const sorted = [...scheduleEvents].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

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
        <div className="space-y-3">
          {sorted.map((event) => {
            const project = findProject(event.projectId ?? "");
            return (
              <div key={event.id} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
                <div className="w-14 text-center flex-shrink-0">
                  <p className="text-xs text-muted-foreground">{event.date.slice(5).replace("-", "/")}</p>
                  <p className="text-sm font-semibold text-foreground">{event.time}</p>
                </div>
                <CalendarIcon size={16} className="text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  {project && <p className="text-xs text-muted-foreground">{project.name}</p>}
                </div>
                <StatusBadge tone={typeTone[event.type]}>{typeLabel[event.type]}</StatusBadge>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
