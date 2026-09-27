import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/**
 * Adónde vuelve quien paga desde el QR de la oficina.
 *
 * Sin sesión a propósito: lo escanea el cliente con su propio móvil, en el
 * mostrador, y no tiene por qué tener cuenta en el portal. Lo único que
 * necesita saber es si el pago entró, para enseñárselo al contratista que
 * tiene delante.
 *
 * No dice «pagado» por haber llegado aquí: eso lo decide el aviso firmado de
 * Stripe, que marca la factura. Esta página sólo confirma que Stripe aceptó
 * la tarjeta, que es lo que Stripe garantiza al redirigir.
 */
export default function PagoRecibido() {
  const { t } = useTranslation();
  const cancelado = new URLSearchParams(window.location.search).has("cancelado");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-end p-3">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          {cancelado ? (
            <XCircle className="mx-auto size-14 text-muted-foreground" strokeWidth={1.5} />
          ) : (
            <CheckCircle2 className="mx-auto size-14 text-status-success-fg" strokeWidth={1.5} />
          )}
          <h1 className="text-xl font-semibold text-foreground">
            {cancelado ? t("cobrar.recibido.canceladoTitulo") : t("cobrar.recibido.titulo")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {cancelado ? t("cobrar.recibido.canceladoTexto") : t("cobrar.recibido.texto")}
          </p>
        </Card>
      </div>
    </div>
  );
}
