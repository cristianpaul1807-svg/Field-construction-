import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus } from "lucide-react";
import { employees } from "@/lib/mockData";

const statusTone = {
  disponible: "success",
  en_proyecto: "info",
  descanso: "neutral",
} as const;

const statusLabel = {
  disponible: "Disponible",
  en_proyecto: "En proyecto",
  descanso: "Descanso",
};

export default function Technicians() {
  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Technicians & Crew"
        description="Empleados internos, disponibilidad y horas trabajadas"
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Plus size={16} /> New Employee
          </Button>
        }
      />

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Nombre</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Rol</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Estado</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Proyecto actual</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Horas (período)</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-secondary transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                        {emp.name.charAt(0)}
                      </div>
                      <span className="text-foreground font-medium">{emp.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-muted-foreground">{emp.role}</td>
                  <td className="py-3">
                    <StatusBadge tone={statusTone[emp.status]}>{statusLabel[emp.status]}</StatusBadge>
                  </td>
                  <td className="py-3 text-muted-foreground">{emp.currentProject ?? "—"}</td>
                  <td className="py-3 text-right text-foreground">{emp.hoursThisPeriod} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
