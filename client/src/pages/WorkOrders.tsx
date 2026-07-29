import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, workOrderStatusTone, priorityTone } from "@/components/StatusBadge";
import { Plus } from "lucide-react";
import { workOrders as initialOrders, findProject } from "@/lib/mockData";

const statusLabel = { pendiente: "Pendiente", en_progreso: "En progreso", completada: "Completada" };
const priorityLabel = { baja: "Baja", media: "Media", alta: "Alta" };

export default function WorkOrders() {
  const [orders] = useState(initialOrders);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Work Orders"
        description="Tareas específicas asignadas, vinculadas a un proyecto"
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Plus size={16} /> New Work Order
          </Button>
        }
      />

      <div className="space-y-3">
        {orders.map((order) => {
          const project = findProject(order.projectId);
          return (
            <Card key={order.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{order.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{order.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {project?.name} · Asignado a {order.assignedTo}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <StatusBadge tone={priorityTone[order.priority]}>{priorityLabel[order.priority]}</StatusBadge>
                  <StatusBadge tone={workOrderStatusTone[order.status]}>{statusLabel[order.status]}</StatusBadge>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Notificación automática por Telegram cuando se crea o asigna una orden (Fase C).
      </p>
    </div>
  );
}
