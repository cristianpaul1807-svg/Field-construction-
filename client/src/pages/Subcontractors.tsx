import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Star, Send, KeyRound } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";

interface Subcontractor {
  id: string;
  name: string;
  trade: string;
  phone: string;
  rating: number;
  telegramLinked: boolean;
  assignedProjects: string[];
}

export default function Subcontractors() {
  const { data: subcontractors, loading, error } = useApi<Subcontractor[]>("/api/subcontractors");
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);

  const generateToken = async (sub: Subcontractor) => {
    const res = await apiFetch(`/api/subcontractors/${sub.id}/access-token`, { method: "POST" });
    const body = await res.json();
    if (res.ok) setNewToken({ name: sub.name, token: body.token });
  };

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

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Cargando subcontratistas...
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          No se pudo cargar desde Supabase: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {subcontractors?.map((sub) => (
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
              <div className="flex gap-2 mt-3">
                {!sub.telegramLinked && (
                  <Button size="sm" variant="outline" className="flex-1 gap-2">
                    <Send size={14} /> Invitar por Telegram
                  </Button>
                )}
                <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => generateToken(sub)}>
                  <KeyRound size={14} /> Código PWA
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!newToken} onOpenChange={(open) => !open && setNewToken(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Código de acceso para {newToken?.name}</DialogTitle>
            <DialogDescription>
              Compártelo con {newToken?.name} para que entre en <code>/campo</code>. No se volverá a mostrar.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-secondary p-4 text-center font-mono text-lg tracking-wider">
            {newToken?.token}
          </div>
          <DialogFooter>
            <Button onClick={() => setNewToken(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
