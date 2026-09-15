import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Check, X, Palmtree } from "lucide-react";
import { useApi, apiFetch, readJson, serverMessage } from "@/lib/api";
import { AvisoDeFallo } from "@/components/AvisoDeFallo";

/**
 * Vacaciones y ausencias.
 *
 * Una pantalla propia y no una pestaña de la agenda: la agenda contesta «quién
 * trabaja el martes» y esto contesta «quién no está en agosto». Mezclarlas
 * obliga a mirar día a día algo que se decide por semanas.
 */

const TIPOS = ["vacaciones", "enfermedad", "permiso", "festivo"] as const;

const TONO: Record<string, StatusTone> = {
  planificada: "warning",
  aprobada: "success",
  rechazada: "error",
};

interface Ausencia {
  id: string;
  startDate: string;
  endDate: string;
  kind: (typeof TIPOS)[number];
  status: keyof typeof TONO;
  notes: string | null;
  requestedBy: string;
  workerName: string | null;
  workerKind: "employee" | "subcontractor";
  employeeId: string | null;
  subcontractorId: string | null;
  days: number;
}

interface Persona {
  id: string;
  name: string;
}

function NuevaAusencia({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const { data: empleados } = useApi<Persona[]>("/api/employees");
  const { data: subcontratistas } = useApi<Persona[]>("/api/subcontractors");

  const [open, setOpen] = useState(false);
  // "employee:uuid" o "subcontractor:uuid": un solo desplegable con las dos
  // listas, porque quien planifica agosto piensa en personas, no en si son
  // plantilla o subcontrata.
  const [quien, setQuien] = useState("");
  const [kind, setKind] = useState<(typeof TIPOS)[number]>("vacaciones");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [notas, setNotas] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    const [tipo, id] = quien.split(":");
    setOcupado(true);
    setError(null);
    try {
      const res = await apiFetch("/api/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(tipo === "employee" ? { employeeId: id } : { subcontractorId: id }),
          kind,
          startDate: desde,
          // Un solo día se marca poniendo la misma fecha en los dos sitios, así
          // que si el de fin va vacío se asume que es el mismo día.
          endDate: hasta || desde,
          notes: notas.trim() || undefined,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(body, t, t("common.genericError")));
      setOpen(false);
      setQuien("");
      setDesde("");
      setHasta("");
      setNotas("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus size={16} /> {t("timeOff.new")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("timeOff.newTitle")}</DialogTitle>
          <DialogDescription>{t("timeOff.newHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("timeOff.who")}</Label>
            <Select value={quien} onValueChange={setQuien}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("timeOff.pickSomeone")} />
              </SelectTrigger>
              <SelectContent>
                {empleados?.map((e) => (
                  <SelectItem key={e.id} value={`employee:${e.id}`}>{e.name}</SelectItem>
                ))}
                {subcontratistas?.map((s) => (
                  <SelectItem key={s.id} value={`subcontractor:${s.id}`}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("timeOff.kindLabel")}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as (typeof TIPOS)[number])}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((k) => (
                  <SelectItem key={k} value={k}>{t(`timeOff.kind.${k}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="au-desde">{t("timeOff.from")}</Label>
              <Input id="au-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="au-hasta">{t("timeOff.to")}</Label>
              <Input id="au-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t("timeOff.toHint")}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="au-notas">{t("common.notes")} ({t("common.optional")})</Label>
            <Textarea id="au-notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={guardar} disabled={ocupado || !quien || !desde}>
            {ocupado ? <Spinner className="size-4" /> : t("common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TimeOff() {
  const { t, i18n } = useTranslation();
  const [recarga, setRecarga] = useState(0);
  const { data: ausencias, loading, error, detalle, reload } = useApi<Ausencia[]>(`/api/time-off?_r=${recarga}`);
  const [fallo, setFallo] = useState<string | null>(null);
  const recargar = () => setRecarga((n) => n + 1);

  const cambiarEstado = async (a: Ausencia, status: string) => {
    setFallo(null);
    const res = await apiFetch(`/api/time-off/${a.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) recargar();
    else setFallo(serverMessage(await readJson(res), t, t("common.genericError")));
  };

  const borrar = async (a: Ausencia) => {
    if (!window.confirm(t("timeOff.deleteConfirm", { name: a.workerName ?? "" }))) return;
    setFallo(null);
    const res = await apiFetch(`/api/time-off/${a.id}`, { method: "DELETE" });
    if (res.ok) recargar();
    else setFallo(serverMessage(await readJson(res), t, t("common.genericError")));
  };

  const fecha = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" });

  // Lo que viene primero es lo que todavía no ha pasado. Una lista que empieza
  // por las vacaciones del año pasado no sirve para planificar nada.
  const hoy = new Date().toISOString().slice(0, 10);
  const { proximas, pasadas } = useMemo(() => {
    const todas = ausencias ?? [];
    return {
      proximas: todas.filter((a) => a.endDate >= hoy).sort((a, b) => a.startDate.localeCompare(b.startDate)),
      pasadas: todas.filter((a) => a.endDate < hoy).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    };
  }, [ausencias, hoy]);

  const Fila = ({ a }: { a: Ausencia }) => (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{a.workerName ?? "—"}</p>
        <p className="text-xs text-muted-foreground">
          {t(`timeOff.kind.${a.kind}`)} · {fecha(a.startDate)}
          {a.endDate !== a.startDate && ` → ${fecha(a.endDate)}`} · {t("timeOff.days", { count: a.days })}
        </p>
        {a.notes && <p className="text-xs text-muted-foreground mt-0.5">{a.notes}</p>}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <StatusBadge tone={TONO[a.status] ?? "info"}>{t(`timeOff.status.${a.status}`)}</StatusBadge>
        {/* Sólo lo que está pedido se aprueba o se rechaza. Ofrecer «aprobar»
            sobre algo ya aprobado es un botón que no hace nada. */}
        {a.status === "planificada" && (
          <>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => cambiarEstado(a, "aprobada")}>
              <Check size={13} /> {t("timeOff.approve")}
            </Button>
            <Button size="sm" variant="outline" aria-label={t("timeOff.reject")} onClick={() => cambiarEstado(a, "rechazada")}>
              <X size={13} />
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" className="text-status-error-fg" aria-label={t("common.delete")} onClick={() => borrar(a)}>
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={t("timeOff.title")}
        description={t("timeOff.description")}
        action={<NuevaAusencia onCreated={recargar} />}
      />

      {fallo && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">{fallo}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}
      {error && (
        <AvisoDeFallo
          mensaje={t("common.loadError", { message: error })}
          detalle={detalle}
          onReintentar={reload}
        />
      )}

      {!loading && !error && (
        <>
          <Card className="p-6">
            <h2 className="text-base font-semibold text-foreground mb-1">{t("timeOff.upcoming")}</h2>
            <p className="text-xs text-muted-foreground mb-3">{t("timeOff.upcomingHint")}</p>
            {proximas.length === 0 ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Palmtree size={16} strokeWidth={1.75} /> {t("timeOff.noneUpcoming")}
              </div>
            ) : (
              proximas.map((a) => <Fila key={a.id} a={a} />)
            )}
          </Card>

          {pasadas.length > 0 && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-foreground mb-3">{t("timeOff.past")}</h2>
              {pasadas.map((a) => <Fila key={a.id} a={a} />)}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
