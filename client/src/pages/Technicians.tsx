import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RateCell } from "@/components/RateCell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { AccessCode } from "@/components/AccessCode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, KeyRound, Pencil, Trash2 } from "lucide-react";
import { useApi, apiFetch, readJson, serverMessage } from "@/lib/api";
import { useTranslation } from "react-i18next";

function NewEmployeeDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
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
      if (!res.ok) throw new Error(serverMessage(body, t, t("technicians.createError")));
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("technicians.createError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 w-full sm:w-auto">
          <Plus size={16} /> {t("technicians.newEmployee")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("technicians.newEmployee")}</DialogTitle>
          <DialogDescription>{t("technicians.newEmployeeDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("common.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("technicians.fullName")} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{t("technicians.role")} ({t("common.optional")})</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("technicians.rolePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.phone")} ({t("common.optional")})</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={create} disabled={!name.trim() || saving}>
            {saving ? t("common.creating") : t("technicians.createEmployee")}
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

const ESTADOS = ["disponible", "en_proyecto", "descanso"] as const;

/** Editar a alguien del equipo: nombre, puesto, teléfono y estado. */
function EditEmployeeDialog({ emp, onSaved, onClose }: { emp: Employee; onSaved: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(emp.name);
  const [role, setRole] = useState(emp.role ?? "");
  const [phone, setPhone] = useState(emp.phone ?? "");
  const [status, setStatus] = useState<string>(emp.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role: role.trim(), phone: phone.trim(), status }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(serverMessage(body, t, t("common.saveError")));
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("technicians.editEmployee")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("common.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{t("technicians.role")} ({t("common.optional")})</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("technicians.rolePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.phone")} ({t("common.optional")})</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.status")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>{t(`technicians.status.${e}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={save} disabled={!name.trim() || saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirmar el borrado, y explicar cuando no se puede.
 *
 * Quien tiene horas o nóminas no se borra: el servidor lo rechaza y aquí se
 * dice por qué y con cuántas. Un "no se pudo" a secas deja al usuario dándole
 * al botón sin saber que nunca va a funcionar.
 */
function DeleteEmployeeDialog({ emp, onDeleted, onClose }: { emp: Employee; onDeleted: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/employees/${emp.id}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) {
        if (body?.code === "employee_has_history") {
          setError(t("technicians.cannotDeleteHistory", {
            name: emp.name,
            entries: body.entries ?? 0,
            payrolls: body.payrolls ?? 0,
          }));
          return;
        }
        throw new Error(serverMessage(body, t, t("common.deleteError")));
      }
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.deleteError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("technicians.deleteEmployee")}</DialogTitle>
          <DialogDescription>{t("technicians.deleteEmployeeConfirm", { name: emp.name })}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-status-error-fg">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          {!error && (
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy ? t("common.saving") : t("common.delete")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Employee {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  /** El código de la PWA, para poder reenviarlo sin invalidar el que ya tiene. */
  accessCode: string | null;
  status: keyof typeof statusTone;
  currentProject: string | null;
  hoursThisPeriod: number;
  hourlyRate: number | null;
}

export default function Technicians() {
  const { t } = useTranslation();
  const [reloadToken, setReloadToken] = useState(0);
  const { data: employees, loading, error } = useApi<Employee[]>(`/api/employees?_r=${reloadToken}`);
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);
  const [editando, setEditando] = useState<Employee | null>(null);
  const [borrando, setBorrando] = useState<Employee | null>(null);
  const recargar = () => setReloadToken((n) => n + 1);

  const generateToken = async (emp: Employee) => {
    const res = await apiFetch(`/api/employees/${emp.id}/access-token`, { method: "POST" });
    const body = await readJson(res);
    if (res.ok) setNewToken({ name: emp.name, token: body.token });
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={t("technicians.title")}
        description={t("technicians.description")}
        action={<NewEmployeeDialog onCreated={() => setReloadToken((t) => t + 1)} />}
      />

      <Card className="p-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Spinner className="size-4" /> {t("common.loading")}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
            {t("common.loadError", { message: error })}
          </div>
        )}
        {/* En el móvil la tabla se salía de la pantalla y las columnas de la
            derecha —donde viven las acciones— quedaban fuera del alcance del
            dedo. Debajo de sm cada persona es una ficha. */}
        {!loading && !error && (
          <div className="sm:hidden divide-y divide-border">
            {employees?.map((emp) => (
              <div key={emp.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {emp.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground font-medium truncate">{emp.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.role || "—"}</p>
                    </div>
                  </div>
                  <StatusBadge tone={statusTone[emp.status]}>{t(`technicians.status.${emp.status}`)}</StatusBadge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>{t("technicians.currentProject")}: {emp.currentProject ?? "—"}</span>
                  <span className="text-right">{emp.hoursThisPeriod} hrs</span>
                </div>
                <AccessCode code={emp.accessCode} />
                {/* Se parte en dos líneas antes que apretar los botones: en un
                    móvil estrecho "Generar código" empuja a la papelera contra
                    el borde y se falla la pulsación. */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <RateCell path={`/api/employees/${emp.id}`} value={emp.hourlyRate} onSaved={recargar} />
                  <div className="flex gap-2 ml-auto">
                    <Button size="sm" variant="outline" className="min-h-11 gap-1.5" onClick={() => generateToken(emp)}>
                      <KeyRound size={14} /> {emp.accessCode ? t("technicians.regenerateCode") : t("technicians.generateCode")}
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-11" aria-label={t("technicians.editEmployee")} onClick={() => setEditando(emp)}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-11 text-status-error-fg" aria-label={t("technicians.deleteEmployee")} onClick={() => setBorrando(emp)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {employees?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("technicians.noEmployees")}</p>
            )}
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("common.name")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("technicians.role")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("common.status")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("technicians.currentProject")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t("technicians.hoursPeriod")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t("technicians.hourlyRate")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t("technicians.pwaAccess")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium sr-only">{t("common.actions")}</th>
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
                      <StatusBadge tone={statusTone[emp.status]}>{t(`technicians.status.${emp.status}`)}</StatusBadge>
                    </td>
                    <td className="py-3 text-muted-foreground">{emp.currentProject ?? "—"}</td>
                    <td className="py-3 text-right text-foreground">{emp.hoursThisPeriod} hrs</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end">
                        <RateCell
                          path={`/api/employees/${emp.id}`}
                          value={emp.hourlyRate}
                          onSaved={() => setReloadToken((n) => n + 1)}
                        />
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <AccessCode code={emp.accessCode} />
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => generateToken(emp)}>
                          <KeyRound size={12} /> {emp.accessCode ? t("technicians.regenerateCode") : t("technicians.generateCode")}
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" aria-label={t("technicians.editEmployee")} onClick={() => setEditando(emp)}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-status-error-fg" aria-label={t("technicians.deleteEmployee")} onClick={() => setBorrando(emp)}>
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editando && (
        <EditEmployeeDialog emp={editando} onSaved={recargar} onClose={() => setEditando(null)} />
      )}
      {borrando && (
        <DeleteEmployeeDialog emp={borrando} onDeleted={recargar} onClose={() => setBorrando(null)} />
      )}

      <Dialog open={!!newToken} onOpenChange={(open) => !open && setNewToken(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("technicians.accessCodeFor", { name: newToken?.name })}</DialogTitle>
            <DialogDescription>
              {t("technicians.accessCodeNote", { name: newToken?.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-secondary p-4 text-center font-mono text-lg tracking-wider">
            {newToken?.token}
          </div>
          <DialogFooter>
            <Button onClick={() => setNewToken(null)}>{t("common.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
