import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/mockData";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";

/**
 * Where the money is between the customer paying and the bank showing it.
 *
 * The app knows what was invoiced and what Stripe says was paid; it does not
 * know what reached the bank, and between the two sit the processing fee and
 * the deposit schedule. Somebody reading "collected $10,000" against a
 * statement showing $9,600 needs to be able to see that the difference is
 * normal without phoning anybody.
 */

interface Deposit {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: string;
  bankReference: string | null;
}

interface Balance {
  connected: boolean;
  available: number;
  pending: number;
  feesInPeriod: number;
  chargedInPeriod: number;
  deposits: Deposit[];
  payoutsBlockedReason: string | null;
}

export function StripeBalanceCard() {
  const { t, i18n } = useTranslation();
  const { data, loading } = useApi<Balance>("/api/reports/stripe-balance");

  // Not connected is not an error and not worth a card: the business that
  // invoices by cheque should not be told about a Stripe balance it has no
  // reason to have.
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("common.loading")}
      </div>
    );
  }
  if (!data?.connected) return null;

  const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.language, { day: "numeric", month: "short" });

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("stripeBalance.title")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("stripeBalance.note")}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Figure label={t("stripeBalance.pending")} value={data.pending} />
        <Figure label={t("stripeBalance.available")} value={data.available} />
        <Figure label={t("stripeBalance.charged")} value={data.chargedInPeriod} />
        <Figure label={t("stripeBalance.fees")} value={data.feesInPeriod} muted />
      </div>

      {/* The fee is the whole reason the bank figure never matches the
          invoiced one, so it is named rather than left to be worked out. */}
      {data.feesInPeriod > 0 && (
        <p className="text-xs text-muted-foreground">{t("stripeBalance.feesNote")}</p>
      )}

      {data.payoutsBlockedReason && (
        <div className="rounded-lg border border-status-warning-fg/30 bg-status-warning-bg/40 p-3">
          <p className="text-xs text-status-warning-fg">{t("stripeBalance.payoutsBlocked")}</p>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-foreground mb-2">{t("stripeBalance.deposits")}</p>
        {data.deposits.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("stripeBalance.noDeposits")}</p>
        ) : (
          <ul className="space-y-2">
            {data.deposits.map((deposit) => (
              <li key={deposit.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground tabular-nums">{formatCurrency(deposit.amount)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t("stripeBalance.arriving", { date: day(deposit.arrivalDate) })}
                  </p>
                </div>
                <StatusBadge tone={deposit.status === "paid" ? "success" : deposit.status === "failed" ? "error" : "info"}>
                  {t(`stripeBalance.status.${deposit.status}`, { defaultValue: deposit.status })}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Figure({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          muted
            ? "text-sm font-semibold text-muted-foreground tabular-nums mt-0.5"
            : "text-sm font-semibold text-foreground tabular-nums mt-0.5"
        }
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}
