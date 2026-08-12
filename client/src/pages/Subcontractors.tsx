import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Star, Send, KeyRound } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface Subcontractor {
  id: string;
  name: string;
  trade: string;
  phone: string;
  rating: number;
  telegramLinked: boolean;
  assignedProjects: string[];
}

function NewSubcontractorDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setTrade("");
    setPhone("");
    setError(null);
  };

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/subcontractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), trade: trade.trim() || undefined, phone: phone.trim() || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || t("subcontractors.createError"));
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("subcontractors.createError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 w-full sm:w-auto">
          <Plus size={16} /> {t("subcontractors.newSubcontractor")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("subcontractors.newSubcontractor")}</DialogTitle>
          <DialogDescription>{t("subcontractors.newSubcontractorDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("common.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("subcontractors.companyOrName")} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{t("subcontractors.trade")} ({t("common.optional")})</Label>
            <Input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder={t("subcontractors.tradePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.phone")} ({t("common.optional")})</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={create} disabled={!name.trim() || saving}>
            {saving ? t("common.creating") : t("subcontractors.createSubcontractor")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Subcontractors() {
  const { t } = useTranslation();
  const [reloadToken, setReloadToken] = useState(0);
  const { data: subcontractors, loading, error } = useApi<Subcontractor[]>(`/api/subcontractors?_r=${reloadToken}`);
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);

  const generateToken = async (sub: Subcontractor) => {
    const res = await apiFetch(`/api/subcontractors/${sub.id}/access-token`, { method: "POST" });
    const body = await res.json();
    if (res.ok) setNewToken({ name: sub.name, token: body.token });
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={t("subcontractors.title")}
        description={t("subcontractors.description")}
        action={<NewSubcontractorDialog onCreated={() => setReloadToken((t) => t + 1)} />}
      />

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
                  {sub.assignedProjects.length > 0 ? sub.assignedProjects.join(", ") : t("subcontractors.noProjects")}
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
                  <KeyRound size={14} /> {t("subcontractors.pwaCode")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
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
