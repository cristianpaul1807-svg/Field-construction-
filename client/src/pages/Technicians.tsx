import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, KeyRound } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";

function NewEmployeeDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setRole("");
    setPhone("");
    setError(null);
  };

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role: role.trim() || undefined, phone: phone.trim() || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "No se pudo crear el empleado");
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el empleado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 w-full sm:w-auto">
          <Plus size={16} /> New Employee
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo empleado</DialogTitle>
          <DialogDescription>Se le abrirá automáticamente una invitación de chat que debe aceptar desde /campo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Rol (opcional)</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ej. Ayudante, Electricista" />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono (opcional)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={create} disabled={!name.trim() || saving}>
            {saving ? "Creando..." : "Crear empleado"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

interface Employee {
  id: string;
  name: string;
  role: string;
  status: keyof typeof statusTone;
  currentProject: string | null;
  hoursThisPeriod: number;
}

export default function Technicians() {
  const [reloadToken, setReloadToken] = useState(0);
  const { data: employees, loading, error } = useApi<Employee[]>(`/api/employees?_r=${reloadToken}`);
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);

  const generateToken = async (emp: Employee) => {
    const res = await apiFetch(`/api/employees/${emp.id}/access-token`, { method: "POST" });
    const body = await res.json();
    if (res.ok) setNewToken({ name: emp.name, token: body.token });
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Technicians & Crew"
        description="Empleados internos, disponibilidad y horas trabajadas"
        action={<NewEmployeeDialog onCreated={() => setReloadToken((t) => t + 1)} />}
      />

      <Card className="p-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Cargando empleados...
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
            No se pudo cargar desde Supabase: {error}
          </div>
        )}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Nombre</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Rol</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Estado</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Proyecto actual</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Horas (período)</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Acceso PWA</th>
                </tr>
              </thead>
              <tbody>
                {employees?.map((emp) => (
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
                    <td className="py-3 text-right">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => generateToken(emp)}>
                        <KeyRound size={12} /> Generar código
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
