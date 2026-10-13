/**
 * El programa de afiliados, visto desde el panel de una empresa.
 *
 * Una empresa cliente también puede recomendar: con su misma cuenta se apunta
 * en `/afiliados` y tiene allí su panel completo (enlace, comisiones, cobro,
 * contenido). Esta pantalla no lo duplica: enseña lo esencial y lleva allí.
 * Dos sitios que calculan lo mismo acaban diciendo cosas distintas.
 *
 * Lo que enseña es sólo lo suyo. Ni la lista de afiliados ni lo que gana otro:
 * esas tablas son nuestras y no se asoman por ninguna ruta de un negocio.
 */
import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Copy, Link2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AvisoDeFallo } from "@/components/AvisoDeFallo";
import { useApi } from "@/lib/api";

interface Panel {
  tieneEnlace: boolean;
  codigo?: string;
  comisionPct?: number;
  referidos?: number;
  pagando?: number;
  devengadoCad?: number;
  pagadoCad?: number;
}

function Cifra({ que, valor }: { que: string; valor: string }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{valor}</p>
      <p className="text-sm text-muted-foreground mt-1">{que}</p>
    </Card>
  );
}

export default function SettingsAfiliados() {
  const { t, i18n } = useTranslation();
  const { data, loading, error, detalle, reload } = useApi<Panel>("/api/settings/afiliados");
  const [copiado, setCopiado] = useState(false);

  const enlace = data?.codigo ? `${window.location.origin}/?ref=${data.codigo}` : "";
  const dinero = (valor: number) => new Intl.NumberFormat(i18n.language, { style: "currency", currency: "CAD" }).format(valor);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1600);
    } catch {
      // Sin permiso para el portapapeles: el enlace sigue a la vista.
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl">
      <PageHeader title={t("afiliado.titulo")} description={t("afiliado.entradilla")} />

      {error && <AvisoDeFallo mensaje={error} detalle={detalle} onReintentar={reload} />}

      {!error && !data?.tieneEnlace && (
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold text-foreground">{t("afiliado.sinEnlaceTitulo")}</h2>
          <p className="text-sm text-muted-foreground">{t("afiliado.sinEnlaceCuerpo")}</p>
          <Button asChild className="h-auto gap-1.5 whitespace-normal py-2 text-left">
            <Link href="/afiliados">
              {t("afiliado.unirme")} <ArrowRight size={14} />
            </Link>
          </Button>
        </Card>
      )}

      {!error && data?.tieneEnlace && (
        <>
          <Card className="p-5 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Link2 size={13} /> {t("afiliado.tuEnlace")}
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2">
              <code className="min-w-0 flex-1 truncate text-xs">{enlace}</code>
              <Button type="button" size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={copiar}>
                {copiado ? <Check size={14} /> : <Copy size={14} />}
                {copiado ? t("afiliado.copiado") : t("afiliado.copiar")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t("afiliado.comision", { pct: data.comisionPct ?? 30 })}</p>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Cifra que={t("afiliado.referidos")} valor={String(data.referidos ?? 0)} />
            <Cifra que={t("afiliado.pagando")} valor={String(data.pagando ?? 0)} />
            <Cifra que={t("afiliado.devengado")} valor={dinero(data.devengadoCad ?? 0)} />
            <Cifra que={t("afiliado.pagado")} valor={dinero(data.pagadoCad ?? 0)} />
          </div>

          {/* El texto es largo a propósito (dice qué hay allí) y en un móvil
              tiene que poder bajar de línea: un botón no parte su texto solo. */}
          <Button asChild variant="outline" className="h-auto gap-1.5 whitespace-normal py-2 text-left">
            <Link href="/afiliados/panel">
              {t("afiliado.abrirPanel")} <ArrowRight size={14} />
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}
