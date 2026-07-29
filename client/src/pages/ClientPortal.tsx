import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { FileSignature, CreditCard, Image as ImageIcon } from "lucide-react";
import { clients, projects, estimates, photos, formatCurrency } from "@/lib/mockData";

export default function ClientPortal() {
  const [selectedClientId, setSelectedClientId] = useState(clients[1].id);
  const client = clients.find((c) => c.id === selectedClientId)!;
  const project = projects.find((p) => p.clientId === client.id);
  const estimate = estimates.find((e) => e.clientId === client.id);
  const total = estimate
    ? estimate.lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0) * (1 + estimate.marginPercent / 100)
    : 0;
  const visiblePhotos = photos.filter((p) => project && p.projectId === project.id && p.visibleToClient);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Client Portal"
        description="Vista previa de lo que ve el cliente al abrir su link único (o vía WhatsApp)"
      />

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Previsualizar como:</span>
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="text-sm border border-input rounded-md px-2 py-1 bg-card"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Simulated client-facing frame */}
      <Card className="p-0 overflow-hidden border-2">
        <div className="bg-secondary px-6 py-4 border-b border-border">
          <p className="text-xs text-muted-foreground">Portal del cliente · solo lectura</p>
          <h2 className="text-lg font-semibold text-foreground mt-0.5">Hola, {client.name.split(" ")[0]}</h2>
        </div>

        <div className="p-6 space-y-6">
          {project && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">{project.name}</p>
                <span className="text-sm text-muted-foreground">{project.progressPercent}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${project.progressPercent}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Avance de tu proyecto</p>
            </div>
          )}

          {estimate && (
            <Card className="p-4 bg-secondary border-none">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Presupuesto #{estimate.id.toUpperCase()}</p>
                  <p className="text-xl font-semibold text-foreground mt-1">{formatCurrency(total)}</p>
                </div>
                <StatusBadge tone="info">{estimate.status}</StatusBadge>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button className="gap-2 flex-1">
                  <FileSignature size={16} /> Firmar presupuesto
                </Button>
                <Button variant="outline" className="gap-2 flex-1">
                  <CreditCard size={16} /> Pagar depósito
                </Button>
              </div>
            </Card>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon size={16} className="text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Fotos compartidas por la empresa</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {visiblePhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="aspect-square rounded-lg border border-border"
                  style={{ background: photo.color }}
                />
              ))}
              {visiblePhotos.length === 0 && (
                <p className="col-span-3 text-xs text-muted-foreground">
                  Aún no hay fotos marcadas como visibles para este cliente.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Solo se muestran fotos y líneas de presupuesto marcadas como "visible_to_client". La firma
        electrónica y el pago se conectarán en Fase E (SignWell / Stripe).
      </p>
    </div>
  );
}
