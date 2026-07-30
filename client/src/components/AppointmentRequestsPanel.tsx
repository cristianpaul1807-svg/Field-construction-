import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Check, X } from "lucide-react";
import { useApi } from "@/lib/api";

interface AppointmentRequest {
  id: string;
  clientId: string;
  clientName: string | null;
  requestedDatetimeText: string;
  reasonText: string | null;
  status: "pendiente" | "confirmada" | "rechazada";
  scheduleEventId: string | null;
  createdAt: string;
}

interface WorkerOption {
  id: string;
  name: string;
}

const statusTone: Record<AppointmentRequest["status"], "info" | "success" | "error"> = {
  pendiente: "info",
  confirmada: "success",
  rechazada: "error",
};

export function AppointmentRequestsPanel() {
  const [reloadToken, setReloadToken] = useState(0);
  const { data: requests, loading } = useApi<AppointmentRequest[]>(`/api/appointment-requests?_r=${reloadToken}`);
  const { data: employees } = useApi<WorkerOption[]>("/api/employees");
  const { data: subcontractors } = useApi<WorkerOption[]>("/api/subcontractors");

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [workerId, setWorkerId] = useState("");
  const [busy, setBusy] = useState(false);

  const workers = [
    ...(employees ?? []).map((e) => ({ id: `emp:${e.id}`, name: e.name })),
    ...(subcontractors ?? []).map((s) => ({ id: `sub:${s.id}`, name: s.name })),
  ];

  const refresh = () => setReloadToken((t) => t + 1);

  const startConfirm = (id: string) => {
    setConfirmingId(id);
    setDate("");
    setTime("09:00");
    setDuration(60);
    setWorkerId("");
  };

  const confirm = async () => {
    if (!confirmingId || !date) return;
    setBusy(true);
    try {
      const [kind, id] = workerId ? workerId.split(":") : [null, null];
      const startTime = new Date(`${date}T${time}:00`).toISOString();
      await fetch(`/api/appointment-requests/${confirmingId}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime,
          durationMinutes: duration,
          assignedEmployeeId: kind === "emp" ? id : null,
          assignedSubcontractorId: kind === "sub" ? id : null,
        }),
      });
      setConfirmingId(null);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const reject = async (id: string) => {
    await fetch(`/api/appointment-requests/${id}/reject`, { method: "PATCH" });
    refresh();
  };

  const pending = (requests ?? []).filter((r) => r.status === "pendiente");
  const resolved = (requests ?? []).filter((r) => r.status !== "pendiente");

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <CalendarClock size={16} /> Solicitudes de cita
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          El cliente propone día/hora y motivo desde el chat — nunca se agenda solo. Confirma un espacio real o
          rechaza la solicitud.
        </p>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Cargando...</p>}

      {!loading && pending.length === 0 && (
        <p className="text-xs text-muted-foreground">Sin solicitudes pendientes.</p>
      )}

      <div className="space-y-3">
        {pending.map((req) => (
          <div key={req.id} className="border border-border rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{req.clientName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Prefiere: {req.requestedDatetimeText}</p>
                {req.reasonText && <p className="text-xs text-muted-foreground mt-0.5">Motivo: {req.reasonText}</p>}
              </div>
              <StatusBadge tone={statusTone[req.status]}>{req.status}</StatusBadge>
            </div>

            {confirmingId === req.id ? (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Fecha</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hora</Label>
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Duración (min)</Label>
                    <Input
                      type="number"
                      min={15}
                      step={15}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Asignar a (opcional)</Label>
                    <Select value={workerId} onValueChange={setWorkerId}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        {workers.map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1" onClick={confirm} disabled={!date || busy}>
                    <Check size={14} /> Confirmar cita
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmingId(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="gap-1" onClick={() => startConfirm(req.id)}>
                  <Check size={14} /> Confirmar
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => reject(req.id)}>
                  <X size={14} /> Rechazar
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {resolved.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">Resueltas</h3>
          {resolved.map((req) => (
            <div key={req.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground truncate">{req.clientName} · {req.requestedDatetimeText}</span>
              <StatusBadge tone={statusTone[req.status]}>{req.status}</StatusBadge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
