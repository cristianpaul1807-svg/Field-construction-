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
import { useApi, apiFetch, readJson } from "@/lib/api";
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
      if (!res.ok) throw new Error(body?.error || t("technicians.createError"));
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

interface Employee {
  id: string;
  name: string;
  role: string;
  status: keyof typeof statusTone;
  currentProject: string | null;
  hoursThisPeriod: number;
}

export default function Technicians() {
  const { t } = useTranslation();
  const [reloadToken, setReloadToken] = useState(0);
  const { data: employees, loading, error } = useApi<Employee[]>(`/api/employees?_r=${reloadToken}`);
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);

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
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("common.name")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("technicians.role")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("common.status")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("technicians.currentProject")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t("technicians.hoursPeriod")}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t("technicians.pwaAccess")}</th>
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
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => generateToken(emp)}>
                        <KeyRound size={12} /> {t("technicians.generateCode")}
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
