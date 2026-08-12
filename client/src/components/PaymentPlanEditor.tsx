import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useApi, apiFetch, readJson } from "@/lib/api";
import { useTranslation } from "react-i18next";

/**
 * The business's default payment schedule.
 *
 * Kept to one screen of rows on purpose: a contractor setting this up is
 * writing down what they already do — half now, a quarter when we start, the
 * rest when it's done — and anything more elaborate than a name, a
 * percentage and when it bills would be a worse version of a conversation
 * they have had a hundred times.
 */

interface Milestone {
  position: number;
  label: string;
  percent: number;
  trigger: string;
}

interface PlanResponse {
  milestones: Milestone[];
  triggers: string[];
}

export function PaymentPlanEditor() {
  const { t } = useTranslation();
  const { data, loading } = useApi<PlanResponse>("/api/payment-plan");
  const [rows, setRows] = useState<Milestone[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Defensive on the shape, not just on null: a response that is not what
    // this expects must land the editor on an empty, usable form rather than
    // leave it spinning forever with no way to tell what went wrong.
    if (data) setRows(Array.isArray(data.milestones) ? data.milestones : []);
  }, [data]);

  const triggers = data?.triggers ?? ["manual"];
  const total = (rows ?? []).reduce((sum, r) => sum + (Number(r.percent) || 0), 0);
  const totalIsRight = Math.abs(total - 100) < 0.01;

  const update = (index: number, patch: Partial<Milestone>) => {
    setSaved(false);
    setRows((current) => (current ?? []).map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const add = () => {
    setSaved(false);
    setRows((current) => [
      ...(current ?? []),
      { position: (current?.length ?? 0) + 1, label: "", percent: 0, trigger: "manual" },
    ]);
  };

  const remove = (index: number) => {
    setSaved(false);
    setRows((current) => (current ?? []).filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/payment-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestones: rows }),
      });
      if (!res.ok) {
        const body = await readJson<{ error?: string; code?: string }>(res);
        throw new Error(body?.code === "plan_not_100" ? t("paymentPlan.mustTotal100") : body?.error || t("common.genericError"));
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !rows) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={index} className="flex flex-col sm:flex-row sm:items-end gap-2 rounded-lg border border-border p-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <Label className="text-xs">{t("paymentPlan.stageName")}</Label>
            <Input
              value={row.label}
              onChange={(e) => update(index, { label: e.target.value })}
              placeholder={t("paymentPlan.stageNamePlaceholder")}
            />
          </div>
          <div className="w-full sm:w-24 space-y-1.5">
            <Label className="text-xs">{t("paymentPlan.percent")}</Label>
            <Input
              type="number"
              min={1}
              max={100}
              step={1}
              value={row.percent}
              onChange={(e) => update(index, { percent: Number(e.target.value) })}
            />
          </div>
          <div className="w-full sm:w-64 space-y-1.5">
            <Label className="text-xs">{t("paymentPlan.billsWhen")}</Label>
            <Select value={row.trigger} onValueChange={(value) => update(index, { trigger: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {triggers.map((trigger) => (
                  <SelectItem key={trigger} value={trigger}>
                    {t(`paymentPlan.triggers.${trigger}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 text-muted-foreground hover:text-status-error-fg"
            onClick={() => remove(index)}
            aria-label={t("common.delete")}
          >
            <Trash2 size={16} strokeWidth={1.75} />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={add}>
          <Plus size={14} /> {t("paymentPlan.addStage")}
        </Button>
        <p className={totalIsRight ? "text-xs text-muted-foreground" : "text-xs text-status-error-fg font-medium"}>
          {t("paymentPlan.total", { percent: Math.round(total * 100) / 100 })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving || !totalIsRight || rows.length === 0}>
          {saving ? <Spinner className="size-4" /> : null}
          {t("common.save")}
        </Button>
        {saved && <span className="text-xs text-muted-foreground">{t("paymentPlan.saved")}</span>}
      </div>
      {error && <p className="text-sm text-status-error-fg">{error}</p>}
    </div>
  );
}
