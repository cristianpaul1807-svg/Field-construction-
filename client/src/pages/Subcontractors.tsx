import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Star, Send } from "lucide-react";
import { subcontractors } from "@/lib/mockData";

export default function Subcontractors() {
  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Subcontractors"
        description="Acceso limitado propio vía Telegram para cada subcontratista"
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Plus size={16} /> New Subcontractor
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {subcontractors.map((sub) => (
          <Card key={sub.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{sub.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub.trade}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-foreground flex-shrink-0">
                <Star size={13} className="fill-status-warning-fg text-status-warning-fg" />
                {sub.rating}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{sub.phone}</p>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground">
                {sub.assignedProjects.length > 0 ? sub.assignedProjects.join(", ") : "Sin proyectos asignados"}
              </p>
              <StatusBadge tone={sub.telegramLinked ? "success" : "neutral"}>
                {sub.telegramLinked ? "Telegram vinculado" : "Sin vincular"}
              </StatusBadge>
            </div>
            {!sub.telegramLinked && (
              <Button size="sm" variant="outline" className="w-full mt-3 gap-2">
                <Send size={14} /> Invitar por Telegram
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
