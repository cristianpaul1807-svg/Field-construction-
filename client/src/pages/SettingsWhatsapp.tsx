import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { MessageCircle, Copy, Check } from "lucide-react";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { useNombresDelMenu } from "@/lib/nombresDelMenu";

/**
 * WhatsApp, entero: el link público, el texto que lo lleva, dónde ponerlo y
 * por qué la conexión directa con Meta no se puede hacer desde aquí.
 *
 * Esto eran dos pantallas —"Conexión WhatsApp" y "Automatizaciones"— que
 * pedían los mismos datos al mismo sitio y enseñaban el mismo link con su
 * mismo botón de copiar, cada una en un apartado del menú. Y la segunda no
 * automatizaba nada: era ese link y un texto sugerido. Separadas obligaban a
 * ir y volver para hacer una sola cosa, que es pegar el link en el mensaje de
 * bienvenida de WhatsApp Business.
 *
 * El orden es el del trabajo: esto es lo que tienes, esto es lo que mandas,
 * aquí lo pones, y esto es lo que haría falta para ir más allá.
 *
 * La conexión directa sigue explicada y sin botón: la API de WhatsApp Business
 * exige que el negocio complete su propia verificación con Meta, y un botón
 * que no puede funcionar es peor que no tenerlo.
 */

interface CompanyData {
  name: string;
  slug: string;
}

function CampoCopiable({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(value);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-start gap-2">
        <pre className="flex-1 min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-lg border border-border bg-secondary/40 p-3 text-sm text-foreground font-sans">
          {value}
        </pre>
        <Button variant="outline" size="icon" className="flex-shrink-0" onClick={copiar} aria-label={t("common.copy")}>
          {copiado ? <Check size={16} /> : <Copy size={16} />}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsWhatsapp() {
  const { t } = useTranslation();
  const menuNombres = useNombresDelMenu();
  const { data, loading, error } = useApi<CompanyData>("/api/settings/company");
  const [copiado, setCopiado] = useState(false);

  const link = data?.slug ? `${window.location.origin}/c/${data.slug}` : "";
  const bienvenida = data && link ? t("settings.suggestedWelcomeText", { business: data.name, link }) : "";

  const copiarLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title={t("settings.whatsappTitle")} description={t("settings.whatsappDescription")} />

      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          {t("common.loadError", { message: error })}
        </div>
      )}

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
              <div className="flex flex-col sm:flex-row gap-2 mt-4 min-w-0">
                <Input
                  readOnly
                  value={link}
                  aria-label={t("settings.yourLinkLabel")}
                  className="font-mono text-xs truncate break-all flex-1 min-w-0"
                  onFocus={(e) => e.target.select()}
                />
                <Button className="gap-2 flex-shrink-0" onClick={copiarLink}>
                  {copiado ? <Check size={15} strokeWidth={1.75} /> : <Copy size={15} strokeWidth={1.75} />}
                  {copiado ? t("invoicing.copied") : t("common.copy")}
                </Button>
              </div>
            ) : (
              !error && <p className="text-sm text-status-warning-fg mt-4">{t("settings.noSlugYet", menuNombres)}</p>
            )}
          </div>
        </div>
      </Card>

      {/* El texto ya trae el link dentro, así que sin link no hay nada que
          pegar y la tarjeta sobra en vez de salir a medias. */}
      {!loading && bienvenida && (
        <Card className="p-6 space-y-4">
          <div>
            <p className="font-medium text-foreground">{t("settings.suggestedWelcome")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("settings.pasteInWhatsapp")}</p>
          </div>
          <CampoCopiable label={t("settings.suggestedMessageLabel")} value={bienvenida} />
        </Card>
      )}

      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-3 text-sm">{t("settings.howToUseLink")}</h3>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>{t("settings.howToUseStep1")}</li>
          <li>{t("settings.howToUseStep2")}</li>
          <li>{t("settings.howToUseStep3")}</li>
        </ol>
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
