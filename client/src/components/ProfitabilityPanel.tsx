import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/mockData";
import { useApi } from "@/lib/api";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

/**
 * Is this job making money.
 *
 * Four figures side by side because they answer four different questions and
 * collapsing them would hide the one that matters. A job can be profitable and
 * unpaid, or paid and losing money; a single "health" score would call those
 * the same thing.
 *
 * Sorted by the worst margin first. Nobody needs to be told about the job that
 * is going fine.
 */

interface ProjectProfit {
  projectId: string;
  name: string;
  clientName: string | null;
  status: string;
  contractValue: number;
  expenses: number;
  labour: number;
  cost: number;
  invoiced: number;
  collected: number;
  margin: number;
  marginPercent: number | null;
  toInvoice: number;
  outstanding: number;
}

export function ProfitabilityPanel() {
  const { t } = useTranslation();
  const { data, loading, error } = useApi<ProjectProfit[]>("/api/reports/profitability");

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("common.loading")}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
        {t("common.loadError", { message: error })}
      </div>
    );
  }

  // A project with no contract and no cost has nothing to say yet.
  const projects = (data ?? []).filter((p) => p.contractValue > 0 || p.cost > 0);
  if (projects.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">{t("profitability.empty")}</p>
      </Card>
    );
  }

  const sorted = [...projects].sort((a, b) => (a.marginPercent ?? 999) - (b.marginPercent ?? 999));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("profitability.title")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("profitability.note")}</p>
      </div>

      {sorted.map((project) => {
        const losing = project.margin < 0;
        const thin = !losing && project.marginPercent !== null && project.marginPercent < 10;
        return (
          <Card key={project.projectId} className="p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/projects/${project.projectId}`}
                  className="text-sm font-semibold text-foreground hover:underline truncate block"
                >
                  {project.name}
                </Link>
                <p className="text-xs text-muted-foreground truncate">
                  {project.clientName ?? t("profitability.noClient")} · {t(`projects.statuses.${project.status}`, { defaultValue: project.status })}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p
                  className={
                    losing
                      ? "text-lg font-semibold text-status-error-fg tabular-nums"
                      : "text-lg font-semibold text-foreground tabular-nums"
                  }
                >
                  {formatCurrency(project.margin)}
                </p>
                {project.marginPercent !== null && (
                  <StatusBadge tone={losing ? "error" : thin ? "warning" : "success"}>
                    {t("profitability.marginPercent", { percent: project.marginPercent })}
                  </StatusBadge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Figure label={t("profitability.contract")} value={project.contractValue} />
              <Figure label={t("profitability.cost")} value={project.cost} />
              <Figure label={t("profitability.invoiced")} value={project.invoiced} />
              <Figure label={t("profitability.collected")} value={project.collected} />
            </div>

            {/* The two gaps worth acting on today, and only when they exist. */}
            {(project.toInvoice > 0 || project.outstanding > 0) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-border">
                {project.toInvoice > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("profitability.toInvoice")}:{" "}
                    <span className="text-foreground tabular-nums">{formatCurrency(project.toInvoice)}</span>
                  </p>
                )}
                {project.outstanding > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("profitability.outstanding")}:{" "}
                    <span className="text-foreground tabular-nums">{formatCurrency(project.outstanding)}</span>
                  </p>
                )}
              </div>
            )}

            {/* Said plainly rather than shown as a zero: a business that has
                not set pay rates would otherwise read this job as cheaper than
                it is. */}
            {project.labour === 0 && project.cost > 0 && (
              <p className="text-xs text-muted-foreground">{t("profitability.noLabourRates")}</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">{formatCurrency(value)}</p>
    </div>
  );
}
