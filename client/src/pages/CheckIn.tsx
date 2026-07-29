import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { MapPin, Check } from "lucide-react";
import { timeEntries, employees, findProject } from "@/lib/mockData";

export default function CheckIn() {
  const [approved, setApproved] = useState<Record<string, boolean>>(
    Object.fromEntries(timeEntries.map((e) => [e.id, e.approved]))
  );

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Check-in / Check-out"
        description="Registro de entrada/salida con hora y ubicación GPS, por proyecto"
      />

      <Card className="p-6">
        <div className="space-y-3">
          {timeEntries.map((entry) => {
            const employee = employees.find((e) => e.id === entry.employeeId);
            const project = findProject(entry.projectId);
            const isApproved = approved[entry.id];
            return (
              <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {employee?.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{employee?.name}</p>
                    <p className="text-xs text-muted-foreground">{project?.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin size={11} /> {entry.location}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Entrada: {entry.checkIn.split(" ")[1]}</p>
                    <p>Salida: {entry.checkOut ? entry.checkOut.split(" ")[1] : "En curso"}</p>
                  </div>
                  {isApproved ? (
                    <StatusBadge tone="success">Aprobado</StatusBadge>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setApproved((p) => ({ ...p, [entry.id]: true }))}>
                      <Check size={14} /> Aprobar horas
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Captura vía Telegram bot con botón "Check-in" que solicita ubicación en tiempo real (Fase C).
      </p>
    </div>
  );
}
