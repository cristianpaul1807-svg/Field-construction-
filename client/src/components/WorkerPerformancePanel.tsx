import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";

/**
 * What was planned for each worker against what they actually did.
 *
 * The comparison a foreman makes in their head and nobody writes down. It is
 * three numbers rather than a score on purpose: a crew who worked longer than
 * planned and a crew who skipped a job would land on the same "efficiency %",
 * and those need opposite conversations.
 */

interface Performance {
  workerId: string;
  kind: "employee" | "subcontractor";
  name: string;
  plannedHours: number;
  actualHours: number;
  overtimeHours: number;
  differenceHours: number;
  adherencePercent: number | null;
  missedJobs: number;
  plannedJobs: number;
}

function defaultPeriod() {
  const end = new Date();
  const start = new Date(end.getTime() - 13 * 86_400_000);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export function WorkerPerformancePanel() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState(defaultPeriod);
  const [reloadToken, setReloadToken] = useState(0);
  const { data, loading } = useApi<{ workers: Performance[] }>(
    `/api/reports/worker-performance?from=${period.from}&to=${period.to}&_r=${reloadToken}`
  );

  const workers = data?.workers ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("performance.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("performance.note")}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs">{t("payroll.from")}</Label>
            <Input type="date" value={period.from} onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} />
          </div>
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs">{t("payroll.to")}</Label>
            <Input type="date" value={period.to} onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} />
          </div>
          <Button variant="outline" onClick={() => setReloadToken((n) => n + 1)}>
            {t("payroll.recalculate")}
          </Button>
        </div>
      </Card>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}

      {!loading && workers.length === 0 && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{t("performance.empty")}</p>
        </Card>
      )}

      {workers.map((worker) => {
        // Off by more than an hour either way is the threshold worth showing:
        // below that it is rounding and traffic, not a pattern.
        const off = Math.abs(worker.differenceHours) > 1;
        return (
          <Card key={worker.workerId} className="p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{worker.name}</p>
                <p className="text-xs text-muted-foreground">
                  {worker.adherencePercent === null
                    ? t("performance.noPlan")
                    : t("performance.adherence", { percent: worker.adherencePercent })}
                </p>
              </div>
              {worker.plannedJobs > 0 && (
                <StatusBadge tone={worker.missedJobs > 0 ? "warning" : off ? "info" : "success"}>
                  {worker.missedJobs > 0
                    ? t("performance.missed", { count: worker.missedJobs, total: worker.plannedJobs })
                    : t("performance.allCovered", { total: worker.plannedJobs })}
                </StatusBadge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Figure label={t("performance.planned")} value={worker.plannedHours} />
              <Figure label={t("performance.actual")} value={worker.actualHours} />
              <Figure label={t("performance.overtime")} value={worker.overtimeHours} />
              <Figure
                label={t("performance.difference")}
                value={worker.differenceHours}
                signed
                tone={off ? (worker.differenceHours > 0 ? "over" : "under") : "flat"}
              />
            </div>
          </Card>
        );
      })}

      {workers.length > 0 && (
        <p className="text-xs text-muted-foreground">{t("performance.overtimeExplainer")}</p>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  signed,
  tone,
}: {
  label: string;
  value: number;
  signed?: boolean;
  tone?: "over" | "under" | "flat";
}) {
  const { t } = useTranslation();
  const text = t("performance.hoursShort", {
    hours: signed && value > 0 ? `+${value}` : String(value),
  });
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === "over"
            ? "text-base font-semibold text-status-warning-fg"
            : tone === "under"
              ? "text-base font-semibold text-status-error-fg"
              : "text-base font-semibold text-foreground"
        }
      >
        {text}
      </p>
    </div>
  );
}
