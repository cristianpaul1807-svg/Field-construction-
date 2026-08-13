import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/mockData";
import { useApi } from "@/lib/api";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

/**
 * Who owes money, oldest first.
 *
 * Ordered for somebody about to make phone calls, not for somebody admiring a
 * total: the client whose oldest invoice is furthest past due comes first,
 * because that is the call that matters most and the one nobody wants to make.
 */

type BucketKey = "corriente" | "d1_30" | "d31_60" | "d61_90" | "d90_mas";

interface ClientBalance {
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
  total: number;
  buckets: Record<BucketKey, number>;
  oldestDaysOverdue: number;
  invoiceCount: number;
}

interface Report {
  total: number;
  buckets: Record<BucketKey, number>;
  clients: ClientBalance[];
  holdbackOutstanding: number;
}

const BUCKETS: BucketKey[] = ["corriente", "d1_30", "d31_60", "d61_90", "d90_mas"];

/** Colour earned by age, not sprinkled: everything current is quiet, and only
 *  real lateness gets a warning tone. */
function toneFor(bucket: BucketKey): "neutral" | "info" | "warning" | "error" {
  if (bucket === "corriente") return "neutral";
  if (bucket === "d1_30") return "info";
  if (bucket === "d31_60" || bucket === "d61_90") return "warning";
  return "error";
}

export function ReceivablesPanel() {
  const { t } = useTranslation();
  const { data, loading, error } = useApi<Report>("/api/reports/receivables");

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
  if (!data) return null;

  const nothingOwed = data.total === 0;

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("receivables.title")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t("receivables.note")}</p>
          </div>
          <p className="text-2xl font-semibold text-foreground tabular-nums">{formatCurrency(data.total)}</p>
        </div>

        {!nothingOwed && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {BUCKETS.map((bucket) => (
              <div key={bucket} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t(`receivables.bucket.${bucket}`)}</p>
                <p
                  className={
                    data.buckets[bucket] > 0 && bucket === "d90_mas"
                      ? "text-sm font-semibold text-status-error-fg tabular-nums mt-1"
                      : "text-sm font-semibold text-foreground tabular-nums mt-1"
                  }
                >
                  {formatCurrency(data.buckets[bucket])}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Held back by contract on invoices the client already settled. Not
            late, not chaseable, and easy to forget it is owed at all. */}
        {data.holdbackOutstanding > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("receivables.holdbackNote", { amount: formatCurrency(data.holdbackOutstanding) })}
          </p>
        )}
      </Card>

      {nothingOwed && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{t("receivables.empty")}</p>
        </Card>
      )}

      {data.clients.map((client) => {
        const worst = [...BUCKETS].reverse().find((bucket) => client.buckets[bucket] > 0) ?? "corriente";
        return (
          <Card key={client.clientId} className="p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {client.clientName ?? t("receivables.unknownClient")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("receivables.invoiceCount", { count: client.invoiceCount })}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(client.total)}</p>
                <StatusBadge tone={toneFor(worst)}>
                  {client.oldestDaysOverdue > 0
                    ? t("receivables.overdueDays", { days: client.oldestDaysOverdue })
                    : t("receivables.notYetDue")}
                </StatusBadge>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {BUCKETS.filter((bucket) => client.buckets[bucket] > 0).map((bucket) => (
                <p key={bucket} className="text-xs text-muted-foreground">
                  {t(`receivables.bucket.${bucket}`)}:{" "}
                  <span className="text-foreground tabular-nums">{formatCurrency(client.buckets[bucket])}</span>
                </p>
              ))}
            </div>

            {/* Straight to their thread rather than a mail client: the chat is
                where this business already talks to this client, and a
                reminder sent there is one they will actually see. */}
            <Button variant="outline" size="sm" asChild>
              <Link href="/communication">{t("receivables.remind")}</Link>
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
