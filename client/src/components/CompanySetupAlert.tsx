import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Building2, ExternalLink } from "lucide-react";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";

/**
 * Lo que tiene que estar puesto antes de entregarle un papel a nadie.
 *
 * Un negocio recién dado de alta se llama como la parte de delante de su
 * correo y no tiene dirección ni números de TPS/TVQ. Esos tres datos se
 * imprimen en cada presupuesto y en cada factura, y en Quebec la factura es un
 * documento legal que los lleva por obligación. Antes nadie lo decía: el
 * contratista descubría el hueco cuando ya le había pasado el PDF al cliente.
 *
 * Es una tira, no una ventana: quien abre la aplicación para ver la dirección
 * de la obra de hoy no debería tener que cerrar un aviso primero. Y desaparece
 * sola en cuanto los datos están, sin que nadie tenga que descartarla.
 */
interface Company {
  name: string;
  address: string | null;
  gstNumber: string | null;
  qstNumber: string | null;
}

export function CompanySetupAlert() {
  const { t } = useTranslation();
  const { data } = useApi<Company>("/api/settings/company");

  if (!data) return null;

  const falta: string[] = [];
  if (!data.address?.trim()) falta.push(t("common.address").toLowerCase());
  if (!data.gstNumber?.trim() || !data.qstNumber?.trim()) falta.push(t("setupAlert.taxNumbers"));

  if (falta.length === 0) return null;

  return (
    <div className="border-b border-status-info-fg/25 bg-status-info-bg/40">
      <div className="px-4 sm:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <Building2 size={16} strokeWidth={1.75} className="text-foreground mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t("setupAlert.title")}</p>
            <p className="text-xs text-muted-foreground">
              {t("setupAlert.body", { missing: falta.join(", ") })}
            </p>
          </div>
        </div>
        <Link href="/settings/company" className="flex-shrink-0">
          <Button size="sm" className="gap-1.5">
            {t("setupAlert.go")} <ExternalLink size={13} strokeWidth={1.75} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
