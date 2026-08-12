import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link2, Check, Copy } from "lucide-react";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface CompanyData {
  name: string;
  slug: string;
}

function CopyField({ label, value }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-start gap-2">
        <pre className="flex-1 whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-3 text-sm text-foreground font-sans">
          {value}
        </pre>
        <Button variant="outline" size="icon" className="flex-shrink-0" onClick={copy}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsAutomations() {
  const { t } = useTranslation();
  const { data, loading, error } = useApi<CompanyData>("/api/settings/company");

  const publicLink = data ? `${window.location.origin}/c/${data.slug}` : "";
  const welcomeMessage = data
    ? t("settings.suggestedWelcomeText", { business: data.name, link: publicLink })
    : "";

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title={t("settings.automationsTitle")}
        description={t("settings.automationsDescription")}
      />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          {t("common.loadError", { message: error })}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-status-info-bg flex items-center justify-center flex-shrink-0">
                <Link2 size={20} className="text-status-info-fg" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="font-medium text-foreground">{t("settings.yourPublicLink")}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cualquiera con este link puede escribirte sin crear cuenta — ideal para compartir en
                    redes, tu bio de Instagram, o pegarlo en tu Mensaje de Bienvenida de WhatsApp Business.
                  </p>
                </div>
                <CopyField label="Tu link" value={publicLink} />
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div>
              <p className="font-medium text-foreground">{t("settings.suggestedWelcome")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("settings.pasteInWhatsapp")}
              </p>
            </div>
            <CopyField label="Mensaje sugerido" value={welcomeMessage} multiline />
          </Card>
        </>
      )}
    </div>
  );
}
