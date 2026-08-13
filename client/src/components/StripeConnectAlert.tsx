import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreditCard, ExternalLink } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

/**
 * The one setup step the business cannot skip without knowing what it costs
 * them, shown until they answer it either way.
 *
 * It is a strip above the page, not a modal: a contractor who opens the app to
 * find today's site address must not have to dismiss a sales pitch first, and
 * an alert that blocks work is an alert people learn to click past without
 * reading. It also has to be answerable — "no thanks" is a real answer, taken
 * once, and then the strip is gone for good. An unanswerable nag is just
 * furniture.
 */

interface ConnectStatus {
  paymentsMode: "sin_definir" | "stripe" | "manual";
  connected: boolean;
  chargesEnabled: boolean;
}

export function StripeConnectAlert() {
  const { t } = useTranslation();
  const { data, reload } = useApi<ConnectStatus>("/api/stripe/connect/status");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  // Nothing to say once they can actually charge, or once they have told us
  // they are handling it themselves.
  if (!data) return null;
  if (data.chargesEnabled) return null;
  if (data.paymentsMode === "manual") return null;

  const declineStripe = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/settings/payments-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "manual" }),
      });
      setConfirming(false);
      reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="border-b border-status-warning-fg/25 bg-status-warning-bg/50">
        <div className="px-4 sm:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <CreditCard size={16} strokeWidth={1.75} className="text-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {data.connected ? t("stripeAlert.titleUnfinished") : t("stripeAlert.title")}
              </p>
              <p className="text-xs text-muted-foreground">{t("stripeAlert.body")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href="/settings/payments">
              <Button size="sm" className="gap-1.5">
                {t("stripeAlert.goConfigure")} <ExternalLink size={13} strokeWidth={1.75} />
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
              {t("stripeAlert.decline")}
            </Button>
          </div>
        </div>
      </div>

      {/* The opt-out is spelled out rather than shrugged off: what stops
          working, what keeps working, and that it is reversible. */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("stripeAlert.declineTitle")}</DialogTitle>
            <DialogDescription>{t("stripeAlert.declineIntro")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium text-foreground">{t("stripeAlert.youLose")}</p>
              <ul className="mt-1 space-y-1 text-muted-foreground list-disc pl-5">
                <li>{t("stripeAlert.loseOnlinePayment")}</li>
                <li>{t("stripeAlert.loseAutoStatus")}</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">{t("stripeAlert.youKeep")}</p>
              <ul className="mt-1 space-y-1 text-muted-foreground list-disc pl-5">
                <li>{t("stripeAlert.keepDocuments")}</li>
                <li>{t("stripeAlert.keepEverythingElse")}</li>
                <li>{t("stripeAlert.keepManualPaid")}</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">{t("stripeAlert.reversible")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={declineStripe} disabled={saving}>
              {saving ? <Spinner className="size-4" /> : null}
              {t("stripeAlert.declineConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
