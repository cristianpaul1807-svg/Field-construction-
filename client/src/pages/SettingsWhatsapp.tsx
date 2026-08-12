import { useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { MessageCircle, Copy, Check, ArrowRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";

// This page used to offer a "Start Embedded Signup" button that did nothing:
// a direct WhatsApp Business connection needs a verified Meta Business
// Manager account and an approved app, neither of which this product can
// create on the business's behalf. So instead of a button that can't work,
// the page hands over the thing that does — the business's own public chat
// link, which a customer reaches from a WhatsApp welcome message, a website,
// an ad or a QR code, with no Meta approval and no per-message fee.
export default function SettingsWhatsapp() {
  const { t } = useTranslation();
  const { data, loading } = useApi<{ slug: string }>("/api/settings/company");
  const [copied, setCopied] = useState(false);

  const link = data?.slug ? `${window.location.origin}/c/${data.slug}` : "";

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title={t("settings.whatsappTitle")} description={t("settings.whatsappDescription")} />

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg bg-status-success-bg flex items-center justify-center flex-shrink-0">
            <MessageCircle size={20} className="text-status-success-fg" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">{t("settings.publicChannelTitle")}</p>
            <p className="text-sm text-muted-foreground mt-2">{t("settings.publicChannelBody")}</p>

            {loading ? (
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <Spinner className="size-4" /> {t("common.loading")}
              </div>
            ) : link ? (
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                <Button className="gap-2 flex-shrink-0" onClick={copy}>
                  {copied ? <Check size={15} strokeWidth={1.75} /> : <Copy size={15} strokeWidth={1.75} />}
                  {copied ? t("invoicing.copied") : t("common.copy")}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-status-warning-fg mt-4">{t("settings.noSlugYet")}</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-3 text-sm">{t("settings.howToUseLink")}</h3>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>{t("settings.howToUseStep1")}</li>
          <li>{t("settings.howToUseStep2")}</li>
          <li>{t("settings.howToUseStep3")}</li>
        </ol>
        <Link href="/settings/automations">
          <Button variant="outline" size="sm" className="gap-2 mt-4">
            {t("settings.openAutomations")} <ArrowRight size={14} strokeWidth={1.75} />
          </Button>
        </Link>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-2 text-sm">{t("settings.directWhatsappTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("settings.directWhatsappBody")}</p>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside mt-3">
          <li>{t("settings.directWhatsappReq1")}</li>
          <li>{t("settings.directWhatsappReq2")}</li>
          <li>{t("settings.directWhatsappReq3")}</li>
        </ol>
      </Card>
    </div>
  );
}
