import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { FileSignature, CreditCard, Image as ImageIcon } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useApi } from "@/lib/api";

interface ClientOption {
  id: string;
  name: string;
}

const invoiceTypeLabel: Record<string, string> = { deposito: "depósito", parcial: "pago parcial", final: "pago final" };

interface ClientPortalData {
  client: { id: string; name: string };
  project: { id: string; name: string; progressPercent: number } | null;
  estimate: { id: string; status: string; total: number } | null;
  pendingInvoice: { id: string; type: string; amount: number; status: string } | null;
  visiblePhotos: { id: string }[];
}

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `oklch(0.74 0.07 ${hash % 360})`;
}

export default function ClientPortal() {
  const { data: clients } = useApi<ClientOption[]>("/api/clients");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const clientId = selectedClientId ?? clients?.[0]?.id ?? null;

  const { data, loading, error } = useApi<ClientPortalData>(clientId ? `/api/client-portal/${clientId}` : null);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Client Portal"
        description="Vista previa de lo que ve el cliente al abrir su link único (o vía WhatsApp)"
      />

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Previsualizar como:</span>
        <select
          value={clientId ?? ""}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="text-sm border border-input rounded-md px-2 py-1 bg-card"
        >
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Cargando portal...
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          No se pudo cargar desde Supabase: {error}
        </div>
      )}

      {!loading && !error && data && (
        <Card className="p-0 overflow-hidden border-2">
          <div className="bg-secondary px-6 py-4 border-b border-border">
            <p className="text-xs text-muted-foreground">Portal del cliente · solo lectura</p>
            <h2 className="text-lg font-semibold text-foreground mt-0.5">Hola, {data.client.name.split(" ")[0]}</h2>
          </div>

          <div className="p-6 space-y-6">
            {data.project && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">{data.project.name}</p>
                  <span className="text-sm text-muted-foreground">{data.project.progressPercent}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${data.project.progressPercent}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Avance de tu proyecto</p>
              </div>
            )}

            {data.estimate && (
              <Card className="p-4 bg-secondary border-none">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Presupuesto #{data.estimate.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xl font-semibold text-foreground mt-1">{formatCurrency(data.estimate.total)}</p>
                  </div>
                  <StatusBadge tone="info">{data.estimate.status}</StatusBadge>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Button className="gap-2 flex-1" disabled title="Vista previa — no interactivo aquí">
                    <FileSignature size={16} /> Firmar presupuesto
                  </Button>
                  <Button variant="outline" className="gap-2 flex-1" disabled title="Vista previa — no interactivo aquí">
                    <CreditCard size={16} />
                    {data.pendingInvoice
                      ? `Pagar ${invoiceTypeLabel[data.pendingInvoice.type] ?? "factura"} (${formatCurrency(data.pendingInvoice.amount)})`
                      : "Pagar depósito"}
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
                {data.visiblePhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="aspect-square rounded-lg border border-border"
                    style={{ background: colorForId(photo.id) }}
                  />
                ))}
                {data.visiblePhotos.length === 0 && (
                  <p className="col-span-3 text-xs text-muted-foreground">
                    Aún no hay fotos marcadas como visibles para este cliente.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Solo se muestran fotos y presupuestos marcados como "visible_to_client". Esta es una vista
        previa de solo lectura — el cliente paga desde su propio portal, no desde aquí. La firma
        electrónica se conectará más adelante (SignWell).
      </p>
    </div>
  );
}
