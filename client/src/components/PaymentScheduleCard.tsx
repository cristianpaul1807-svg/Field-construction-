import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, invoiceStatusTone } from "@/components/StatusBadge";
import { Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useTranslation } from "react-i18next";

/**
 * A project's payment schedule, as the contractor and the customer both see it.
 *
 * The same rows, minus the button, are what the portal shows: there is one
 * schedule and both sides should be reading it, not two views that can
 * disagree about what has been billed.
 */

export interface PaymentMilestone {
  id: string;
  position: number;
  label: string;
  percent: number;
  trigger?: string;
  invoiceId: string | null;
  amount: number | null;
  /** Present on the panel; the portal calls the same field `status`. */
  invoiceStatus?: string | null;
  status?: string | null;
  dueDate: string | null;
}

export function PaymentScheduleCard({
  milestones,
  onBill,
  billingId,
}: {
  milestones: PaymentMilestone[];
  /** Omitted in the portal: the customer reads the schedule, never bills it. */
  onBill?: (milestoneId: string) => void;
  billingId?: string | null;
}) {
  const { t } = useTranslation();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Receipt size={16} className="text-muted-foreground" strokeWidth={1.75} />
        <h3 className="font-semibold text-foreground text-sm">{t("paymentPlan.title")}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{t("paymentPlan.subtitle")}</p>

      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("paymentPlan.none")}</p>
      ) : (
        <ul className="space-y-3">
          {milestones.map((milestone) => {
            const status = milestone.invoiceStatus ?? milestone.status ?? null;
            return (
              <li
                key={milestone.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">{milestone.position}.</span> {milestone.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("paymentPlan.percentOfTotal", { percent: milestone.percent })}
                    {milestone.trigger ? ` · ${t(`paymentPlan.triggers.${milestone.trigger}`)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {milestone.amount !== null && (
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(milestone.amount)}</span>
                  )}
                  {status ? (
                    <StatusBadge tone={invoiceStatusTone[status] ?? "neutral"}>
                      {t(`invoicing.status.${status}`)}
                    </StatusBadge>
                  ) : onBill ? (
                    <Button size="sm" variant="outline" onClick={() => onBill(milestone.id)} disabled={billingId === milestone.id}>
                      {billingId === milestone.id ? <Spinner className="size-4" /> : null}
                      {t("paymentPlan.billNow")}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("paymentPlan.notBilledYet")}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
