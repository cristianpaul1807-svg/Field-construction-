import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, apiFetch } from "@/lib/api";

const TYPE_OPTIONS = ["visita", "llamada", "reunion", "inicio", "fin"] as const;

interface WorkerOption {
  id: string;
  name: string;
}

interface ScheduleEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initialDate: Date;
  onCreated: () => void;
}

export function ScheduleEventDialog({ open, onOpenChange, projectId, initialDate, onCreated }: ScheduleEventDialogProps) {
  const { t } = useTranslation();
  const { data: employees } = useApi<WorkerOption[]>(open ? "/api/employees" : null);
  const { data: subcontractors } = useApi<WorkerOption[]>(open ? "/api/subcontractors" : null);

  const [mode, setMode] = useState<"trabajo" | "nota">("trabajo");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("visita");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [workerId, setWorkerId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const d = initialDate;
    setDate(d.toISOString().slice(0, 10));
    setTime(`${String(d.getHours()).padStart(2, "0")}:00`);
    setTitle("");
    setMode("trabajo");
    setWorkerId("");
    setNotes("");
    setDurationMinutes(60);
    setError(null);
  }, [open, initialDate]);

  const workers = [
    ...(employees ?? []).map((e) => ({ id: `emp:${e.id}`, name: e.name })),
    ...(subcontractors ?? []).map((s) => ({ id: `sub:${s.id}`, name: s.name })),
  ];

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError(t("scheduling.titleRequired"));
      return;
    }
    if (mode === "trabajo" && !workerId) {
      setError(t("scheduling.workerRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const startTime = new Date(`${date}T${time}:00`);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
      const [kind, id] = workerId ? workerId.split(":") : [null, null];

      const res = await apiFetch("/api/schedule-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title,
          type,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          notes: notes || null,
          assignedEmployeeId: mode === "trabajo" && kind === "emp" ? id : null,
          assignedSubcontractorId: mode === "trabajo" && kind === "sub" ? id : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || t("common.saveError"));
      }
      onCreated();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("scheduling.addToSchedule")}</DialogTitle>
          <DialogDescription>
            {t("scheduling.addToScheduleHint")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              onClick={() => setMode("trabajo")}
              className={`flex-1 py-1.5 transition-colors ${mode === "trabajo" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"}`}
            >
              {t("scheduling.assignedWork")}
            </button>
            <button
              onClick={() => setMode("nota")}
              className={`flex-1 py-1.5 transition-colors ${mode === "nota" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"}`}
            >
              {t("scheduling.manualNote")}
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-title">{t("common.title")}</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === "trabajo" ? t("scheduling.titlePlaceholderWork") : t("scheduling.titlePlaceholderNote")}
            />
          </div>

          {mode === "trabajo" && (
            <div className="space-y-1.5">
              <Label>{t("budgets.worker")}</Label>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("scheduling.selectWorker")} />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label htmlFor="event-type">{t("common.type")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full" id="event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{t(`scheduling.types.${o}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-1">
              <Label htmlFor="event-date">{t("common.date")}</Label>
              <Input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-1">
              <Label htmlFor="event-time">{t("scheduling.time")}</Label>
              <Input id="event-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-duration">{t("common.duration")}</Label>
            <Input
              id="event-duration"
              type="number"
              min={15}
              step={15}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-notes">{t("scheduling.notes")}</Label>
            <Textarea
              id="event-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("scheduling.notesPlaceholder")}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-status-error-fg">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
