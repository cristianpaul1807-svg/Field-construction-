import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSignature, CreditCard, Image as ImageIcon, LogOut, LayoutDashboard, MessageCircle } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ClientChat } from "@/components/ClientChat";

interface ClientPortalData {
  client: { id: string; name: string };
  project: { id: string; name: string; progressPercent: number } | null;
  estimate: { id: string; status: string; total: number } | null;
  visiblePhotos: { id: string }[];
}

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `oklch(0.74 0.07 ${hash % 360})`;
}

export default function ClientPortalMe() {
  const { signOut } = useAuth();
  const { data, loading, error } = useApi<ClientPortalData>("/api/client-portal/me");

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold text-sm">
            R
          </div>
          <span className="font-semibold text-foreground text-sm">Portal del cliente</span>
        </div>
        <Button variant="ghost" size="sm" className="gap-2" onClick={signOut}>
          <LogOut size={14} /> Cerrar sesión
        </Button>
      </div>

      <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6">
        <Tabs defaultValue="resumen">
          <TabsList className="w-full">
            <TabsTrigger value="resumen" className="flex-1 gap-1.5">
              <LayoutDashboard size={14} /> Resumen
            </TabsTrigger>
            <TabsTrigger value="mensajes" className="flex-1 gap-1.5">
              <MessageCircle size={14} /> Mensajes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="mt-4 space-y-6">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Spinner className="size-4" /> Cargando portal...
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
                No se pudo cargar: {error}
              </div>
            )}

            {!loading && !error && data && (
              <Card className="p-0 overflow-hidden border-2">
            <div className="bg-secondary px-6 py-4 border-b border-border">
              <p className="text-xs text-muted-foreground">Solo lectura</p>
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

              {!data.project && (
                <p className="text-sm text-muted-foreground">Todavía no tienes un proyecto activo.</p>
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
                  {data.visiblePhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="aspect-square rounded-lg border border-border"
                      style={{ background: colorForId(photo.id) }}
                    />
                  ))}
                  {data.visiblePhotos.length === 0 && (
                    <p className="col-span-3 text-xs text-muted-foreground">
                      Aún no hay fotos marcadas como visibles para ti.
                    </p>
                  )}
                </div>
              </div>
            </div>
              </Card>
            )}

            <p className="text-xs text-muted-foreground text-center">
              La firma electrónica y el pago se conectarán en Fase E (SignWell / Stripe).
            </p>
          </TabsContent>

          <TabsContent value="mensajes" className="mt-4">
            <ClientChat />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
