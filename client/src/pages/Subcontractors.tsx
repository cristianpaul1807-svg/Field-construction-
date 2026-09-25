import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RateCell } from "@/components/RateCell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Star, KeyRound, Trash2 , FolderOpen } from "lucide-react";
import { AcuerdosDeTrabajo, BotonDeAcuerdos } from "@/components/AcuerdosDeTrabajo";
import { PapelesDeLaPersona } from "@/components/PapelesDeLaPersona";
import { AccessCode } from "@/components/AccessCode";
import { useApi, apiFetch, readJson, serverMessage, apiEnviar } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { AvisoDeFallo } from "@/components/AvisoDeFallo";
import { BorrarConHistorial } from "@/components/BorrarConHistorial";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Subcontractor {
  id: string;
  name: string;
  trade: string;
  phone: string;
  rating: number;
  hasAccessCode: boolean;
  /** El código en claro, para poder reenviarlo. */
  accessCode: string | null;
  assignedProjects: string[];
  hourlyRate: number | null;
}

function NewSubcontractorDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const { data: roles } = useApi<{ id: string; name: string }[]>("/api/worker-roles");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [roleId, setRoleId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setTrade("");
    setRoleId("");
    setEmail("");
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
        body: JSON.stringify({ name: name.trim(), trade: trade.trim() || undefined, roleId, email: email.trim() || undefined, phone: phone.trim() || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(serverMessage(body, t, t("subcontractors.createError")));
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
          <div className="space-y-1.5"><Label>Rol de acceso</Label><Select value={roleId} onValueChange={setRoleId}><SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger><SelectContent>{(roles ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
          {roles?.find((r) => r.id === roleId)?.name !== "trabajador_de_campo" && roles?.find((r) => r.id === roleId)?.name !== "subcontratista" && <div className="space-y-1.5"><Label>Email de acceso</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>}
          <div className="space-y-1.5">
            <Label>{t("subcontractors.trade")} ({t("common.optional")})</Label>
            <Input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder={t("subcontractors.tradePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.phone")} ({t("common.optional")})</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={create} disabled={!name.trim() || !roleId || saving}>
            {saving ? t("common.creating") : t("subcontractors.createSubcontractor")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Con quién repetirías, guardado donde se puede consultar.
 *
 * La estrella estaba pintada pero no se podía tocar: el servidor aceptaba
 * rating desde el principio —validado de 0 a 5— y ninguna pantalla lo mandaba
 * nunca. Con la columna vacía por defecto, un subcontratista recién dado de
 * alta enseñaba una estrella sola, sin número, para siempre.
 *
 * Se guarda al pulsar. Volver a pulsar la misma estrella lo borra, porque
 * "todavía no lo sé" es una respuesta legítima sobre alguien con quien sólo
 * has trabajado una vez.
 */
function Valoracion({ subId, valor, onSaved }: { subId: string; valor: number | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const [guardando, setGuardando] = useState(false);
  const [encima, setEncima] = useState<number | null>(null);

  const poner = async (estrellas: number | null) => {
    setGuardando(true);
    try {
      await apiEnviar(`/api/subcontractors/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: estrellas ?? 0 }),
      });
      onSaved();
    } finally {
      setGuardando(false);
    }
  };

  const marcadas = encima ?? Math.round(valor ?? 0);

  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" onMouseLeave={() => setEncima(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={guardando}
          aria-label={t("subcontractors.rateStars", { count: n })}
          onMouseEnter={() => setEncima(n)}
          onClick={() => poner(Math.round(valor ?? 0) === n ? null : n)}
          className="p-0.5 disabled:opacity-50"
        >
          <Star
            size={14}
            className={
              n <= marcadas
                ? "fill-status-warning-fg text-status-warning-fg"
                : "text-muted-foreground/40"
            }
          />
        </button>
      ))}
    </div>
  );
}

export default function Subcontractors() {
  const { t } = useTranslation();
  const [reloadToken, setReloadToken] = useState(0);
  const { data: subcontractors, loading, error, detalle, reload } = useApi<Subcontractor[]>(`/api/subcontractors?_r=${reloadToken}`);
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);
  const [acuerdosDe, setAcuerdosDe] = useState<Subcontractor | null>(null);
  const [papelesDe, setPapelesDe] = useState<Subcontractor | null>(null);
  const [borrando, setBorrando] = useState<Subcontractor | null>(null);

  const generateToken = async (sub: Subcontractor) => {
    const res = await apiFetch(`/api/subcontractors/${sub.id}/access-token`, { method: "POST" });
    const body = await readJson(res);
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
        <AvisoDeFallo
          mensaje={t("common.loadError", { message: error })}
          detalle={detalle}
          onReintentar={reload}
        />
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
                <Valoracion
                  subId={sub.id}
                  valor={sub.rating}
                  onSaved={() => setReloadToken((n) => n + 1)}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3">{sub.phone}</p>
              <div className="flex items-center justify-between gap-2 mt-3">
                <span className="text-xs text-muted-foreground">{t("technicians.hourlyRate")}</span>
                <RateCell
                  path={`/api/subcontractors/${sub.id}`}
                  value={sub.hourlyRate}
                  onSaved={() => setReloadToken((n) => n + 1)}
                />
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  {sub.assignedProjects.length > 0 ? sub.assignedProjects.join(", ") : t("subcontractors.noProjects")}
                </p>
                <StatusBadge tone={sub.hasAccessCode ? "success" : "neutral"}>
                  {sub.hasAccessCode ? t("subcontractors.codeIssued") : t("subcontractors.noCodeYet")}
                </StatusBadge>
              </div>
              {/* El código a la vista, para poder reenviárselo. Generar otro
                  sigue estando, pero ya no es la única forma de recuperarlo:
                  antes, dárselo de nuevo a uno se lo rompía al que ya lo tenía
                  funcionando. */}
              {sub.accessCode && <AccessCode code={sub.accessCode} className="mt-3" />}
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => generateToken(sub)}>
                  <KeyRound size={14} /> {sub.hasAccessCode ? t("subcontractors.newPwaCode") : t("subcontractors.pwaCode")}
                </Button>
                <BotonDeAcuerdos label={t("agreements.open")} onClick={() => setAcuerdosDe(sub)} />
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11 sm:min-h-0"
                  aria-label={t("workerDocs.open")}
                  title={t("workerDocs.open")}
                  onClick={() => setPapelesDe(sub)}
                >
                  <FolderOpen size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-status-error-fg"
                  aria-label={t("common.delete")}
                  onClick={() => setBorrando(sub)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {borrando && (
        <BorrarConHistorial
          titulo={t("subcontractors.deleteSub")}
          confirmacion={t("subcontractors.deleteSubConfirm", { name: borrando.name })}
          ruta={`/api/subcontractors/${borrando.id}`}
          onBorrado={() => setReloadToken((n) => n + 1)}
          onCerrar={() => setBorrando(null)}
        />
      )}

      {papelesDe && (
        <PapelesDeLaPersona
          kind="subcontractor"
          workerId={papelesDe.id}
          workerName={papelesDe.name}
          onClose={() => setPapelesDe(null)}
        />
      )}

      {acuerdosDe && (
        <AcuerdosDeTrabajo
          kind="subcontractor"
          workerId={acuerdosDe.id}
          workerName={acuerdosDe.name}
          onClose={() => setAcuerdosDe(null)}
        />
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
