import { Card } from "@/components/ui/card";
import { Check, Circle, DoorOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * The execution order of a job, as the software actually knows it.
 *
 * Every item here is derived on the server from a real row — an accepted
 * estimate, a booked event, a check-in, a closed work order, a paid invoice —
 * so this is a report, not a form. Nothing on it is clickable for that reason:
 * a step gets ticked by doing the thing, not by saying you did it.
 */

export interface LifecycleStep {
  key: string;
  status: string;
  done: boolean;
}

export interface Lifecycle {
  status: string;
  origin: string;
  statusChangedAt: string | null;
  steps: LifecycleStep[];
  nextStep: string | null;
  history: Array<{
    from: string | null;
    to: string;
    trigger: string;
    actor: string;
    note: string | null;
    at: string;
  }>;
}

export function LifecyclePanel({ lifecycle, showHistory = true }: { lifecycle: Lifecycle; showHistory?: boolean }) {
  const { t, i18n } = useTranslation();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" });

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="font-semibold text-foreground text-sm">{t("projects.lifecycle.title")}</h3>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <DoorOpen size={13} />
          {t(`projects.lifecycle.origin.${lifecycle.origin}`)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{t("projects.lifecycle.subtitle")}</p>

      <ol className="space-y-2.5">
        {lifecycle.steps.map((step) => {
          const isNext = step.key === lifecycle.nextStep;
          return (
            <li key={step.key} className="flex items-start gap-2.5">
              <span
                className={
                  step.done
                    ? "mt-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"
                    : "mt-0.5 w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground"
                }
              >
                {step.done ? <Check size={11} strokeWidth={3} /> : <Circle size={11} />}
              </span>
              <div className="min-w-0">
                <p className={step.done ? "text-sm text-foreground" : "text-sm text-muted-foreground"}>
                  {t(`projects.lifecycle.steps.${step.key}`)}
                </p>
                {isNext && (
                  <p className="text-xs text-primary font-medium">{t("projects.lifecycle.nextStep")}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {lifecycle.nextStep === null && (
        <p className="text-xs text-muted-foreground mt-4">{t("projects.lifecycle.allDone")}</p>
      )}
      {lifecycle.statusChangedAt && (
        <p className="text-xs text-muted-foreground mt-4">
          {t("projects.lifecycle.since", { date: formatDate(lifecycle.statusChangedAt) })}
        </p>
      )}

      {showHistory && (
        <div className="mt-5 pt-4 border-t border-border">
          <h4 className="text-xs font-semibold text-foreground mb-2">{t("projects.lifecycle.history")}</h4>
          {lifecycle.history.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("projects.lifecycle.noHistory")}</p>
          ) : (
            <ul className="space-y-1.5">
              {lifecycle.history.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="text-xs text-muted-foreground">
                  <span className="text-foreground">{t(`projects.statuses.${entry.to}`)}</span>
                  {" · "}
                  {t(`projects.lifecycle.triggers.${entry.trigger}`)}
                  {" · "}
                  {t(`projects.lifecycle.actors.${entry.actor}`)}
                  {" · "}
                  {formatDate(entry.at)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
