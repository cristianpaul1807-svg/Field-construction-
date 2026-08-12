import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, CheckCircle2, ArrowRight, Send, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useApi, apiFetch, readJson, downloadFile } from "@/lib/api";

interface ProjectionItem {
  id: string;
  title: string;
  zone: string | null;
  plannedStart: string;
  durationMinutes: number;
  status: "pendiente" | "aplicado";
  assignedWorkerId: string | null;
  assignedWorkerName: string | null;
}

interface WorkerOption {
  id: string;
  name: string;
}

interface WorkProjectionPanelProps {
  estimateId: string;
  status: string;
  createdBy: string;
  clientName: string | null;
  onChanged: () => void;
}

export function WorkProjectionPanel({ estimateId, status, createdBy, clientName, onChanged }: WorkProjectionPanelProps) {
  const { t, i18n } = useTranslation();
  const [reloadToken, setReloadToken] = useState(0);
  const { data: items, loading } = useApi<ProjectionItem[]>(
    `/api/estimates/${estimateId}/projection?_r=${reloadToken}`
  );
  const { data: employees } = useApi<WorkerOption[]>("/api/employees");
  const { data: subcontractors } = useApi<WorkerOption[]>("/api/subcontractors");

  const [title, setTitle] = useState("");
  const [zone, setZone] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ projectId: string; scheduledCount: number } | null>(null);
  const [sendPrompt, setSendPrompt] = useState(false);
  const [sendMessage, setSendMessage] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentOk, setSentOk] = useState(false);

  const refresh = () => {
    setReloadToken((t) => t + 1);
    onChanged();
  };

  const workers = [
    ...(employees ?? []).map((e) => ({ id: `emp:${e.id}`, name: e.name })),
    ...(subcontractors ?? []).map((s) => ({ id: `sub:${s.id}`, name: s.name })),
  ];

  const addItem = async () => {
    if (!title.trim() || !date) return;
    setBusy(true);
    try {
      const [kind, id] = workerId ? workerId.split(":") : [null, null];
      const plannedStart = new Date(`${date}T${time}:00`).toISOString();
      const res = await apiFetch(`/api/estimates/${estimateId}/projection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          zone: zone || null,
          plannedStart,
          durationMinutes: duration,
          assignedEmployeeId: kind === "emp" ? id : null,
          assignedSubcontractorId: kind === "sub" ? id : null,
        }),
      });
      if (!res.ok) throw new Error();
      setTitle("");
      setZone("");
      setWorkerId("");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    await apiFetch(`/api/estimates/${estimateId}/projection/${itemId}`, { method: "DELETE" });
    refresh();
  };

  // Approving asks first, because approving and delivering are two different
  // decisions: the contractor may want to read the PDF once more, or call the
  // customer before it lands in their chat.
  const approveDraft = () => setSendPrompt(true);

  const approveOnly = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/estimates/${estimateId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "enviado" }),
      });
      setSendPrompt(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const approveAndDeliver = async () => {
    setBusy(true);
    setSendError(null);
    try {
      // One call: it marks the estimate as sent and posts the PDF into the
      // client's own conversation, so the two can never disagree.
      const res = await apiFetch(`/api/estimates/${estimateId}/send-to-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: sendMessage.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await readJson<{ error?: string }>(res))?.error || t("common.genericError"));
      setSendPrompt(false);
      setSentOk(true);
      onChanged();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setBusy(false);
    }
  };

  const previewPdf = async () => {
    await downloadFile(
      `/api/estimates/${estimateId}/pdf?lang=${i18n.language.slice(0, 2)}`,
      `${t("budgets.estimateFilePrefix")}-${estimateId.slice(0, 8).toUpperCase()}.pdf`
    );
  };

  const acceptEstimate = async () => {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/estimates/${estimateId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: clientName ? t("budgets.projectNameFromClient", { client: clientName }) : undefined }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body?.error || t("budgets.acceptError"));
      setResult(body);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const pendingItems = (items ?? []).filter((i) => i.status === "pendiente");

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("budgets.projectionTitle")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("budgets.projectionHint")}
          </p>
        </div>
        {createdBy === "bot" && <StatusBadge tone="info">Generado por IA</StatusBadge>}
      </div>

      {result ? (
        <div className="rounded-lg border border-status-success-bg bg-status-success-bg/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-status-success-fg text-sm font-medium">
            <CheckCircle2 size={16} /> Presupuesto aceptado
          </div>
          <p className="text-xs text-muted-foreground">
            {t("budgets.projectionApplied", { count: result.scheduledCount })}
          </p>
          <Link href={`/projects/${result.projectId}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            {t("budgets.viewProject")} <ArrowRight size={12} />
          </Link>
        </div>
      ) : (
        <>
          {!loading && (
            <div className="space-y-2">
              {pendingItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-sm py-2 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-foreground truncate">
                      {item.title} {item.zone && <span className="text-muted-foreground">· {item.zone}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.plannedStart).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
                      {" · "}
                      {item.durationMinutes} min
                      {item.assignedWorkerName && <> · {item.assignedWorkerName}</>}
                    </p>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-status-error-fg flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {pendingItems.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">{t("budgets.noProjectionItems")}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="proj-title">{t("common.title")}</Label>
              <Input id="proj-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Instalar piso de cocina" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-zone">{t("budgets.zone")} ({t("common.optional")})</Label>
              <Input id="proj-zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ej. Cocina" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("budgets.worker")} ({t("common.optional")})</Label>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("common.unassigned")} />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-date">{t("common.date")}</Label>
              <Input id="proj-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-time">{t("scheduling.time")}</Label>
              <Input id="proj-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="proj-duration">{t("common.duration")}</Label>
              <Input id="proj-duration" type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={addItem} disabled={busy}>
            <Plus size={14} /> {t("budgets.addToProjection")}
          </Button>

          <div className="flex gap-2 pt-2 border-t border-border">
            {status === "pendiente_aprobacion" && (
              <Button className="flex-1" onClick={approveDraft} disabled={busy}>
                {t("budgets.approveAndSend")}
              </Button>
            )}
            {status === "enviado" && (
              <Button className="flex-1" onClick={acceptEstimate} disabled={busy}>
                Aceptar presupuesto (crea proyecto + agenda)
              </Button>
            )}
            {status !== "pendiente_aprobacion" && status !== "enviado" && (
              <p className="text-xs text-muted-foreground">
                {status === "aceptado" ? t("budgets.alreadyAccepted") : t("budgets.sendBeforeAccept")}
              </p>
            )}
          </div>
        </>
      )}

      {sentOk && (
        <div className="rounded-lg border border-status-success-bg bg-status-success-bg/40 p-3 text-sm text-status-success-fg flex items-center gap-2">
          <CheckCircle2 size={15} strokeWidth={1.75} /> {t("budgets.sentToClient")}
        </div>
      )}

      <Dialog open={sendPrompt} onOpenChange={setSendPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("budgets.sendToClientTitle")}</DialogTitle>
            <DialogDescription>{t("budgets.sendToClientHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={previewPdf}>
              <FileText size={14} strokeWidth={1.75} /> {t("budgets.reviewPdfFirst")}
            </Button>
            <div className="space-y-1.5">
              <Label htmlFor="send-note">{t("budgets.messageToClient")}</Label>
              <Textarea
                id="send-note"
                rows={3}
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                placeholder={t("budgets.messageToClientPlaceholder")}
              />
            </div>
            {sendError && <p className="text-sm text-status-error-fg">{sendError}</p>}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={approveOnly} disabled={busy} className="sm:flex-1">
              {t("budgets.approveWithoutSending")}
            </Button>
            <Button onClick={approveAndDeliver} disabled={busy} className="gap-2 sm:flex-1">
              <Send size={14} strokeWidth={1.75} /> {t("budgets.approveAndDeliver")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
