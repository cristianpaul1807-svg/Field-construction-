import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { MapPin } from "lucide-react";
import { employees, subcontractors } from "@/lib/mockData";

export default function GpsRouting() {
  const activeCrew = employees.filter((e) => e.status === "en_proyecto");

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="GPS & Routing"
        description="Ubicación en tiempo real de técnicos y subcontratistas activos"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="h-96 bg-secondary flex flex-col items-center justify-center gap-2 text-center px-6">
            <MapPin size={28} className="text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Mapa en espera de API key</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Se conectará con Google Maps API (o Mapbox) cuando el negocio configure su clave.
              Por ahora este es un placeholder visual.
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-foreground mb-3 text-sm">Activos ahora</h3>
          <div className="space-y-3">
            {activeCrew.map((emp) => (
              <div key={emp.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {emp.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{emp.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{emp.currentProject}</p>
                </div>
                <StatusBadge tone="success">En ruta</StatusBadge>
              </div>
            ))}
            {subcontractors.filter((s) => s.assignedProjects.length > 0).map((sub) => (
              <div key={sub.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary text-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {sub.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{sub.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{sub.assignedProjects[0]}</p>
                </div>
                <StatusBadge tone="info">Subcontratista</StatusBadge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
