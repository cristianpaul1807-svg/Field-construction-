/**
 * «Gana el 30 % recomendándonos», en los sitios por donde pasa quien conoce
 * a otros contratistas: el panel de la empresa, la app del trabajador y el
 * portal del cliente.
 *
 * Una línea al final y no un cartel arriba: quien abre cualquiera de esas
 * pantallas viene a otra cosa, y lo primero tiene que ser lo suyo.
 *
 * `destino`: desde el panel se va a Ajustes, donde la empresa se apunta con
 * su misma cuenta; desde fuera, a la puerta pública del programa.
 */
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowRight, HandCoins } from "lucide-react";

export function AnuncioAfiliados({ destino = "/afiliados" }: { destino?: string }) {
  const { t } = useTranslation();
  return (
    <Link
      href={destino}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/60"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <HandCoins size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{t("anuncioAfiliados.titulo")}</span>
        <span className="block text-xs text-muted-foreground">{t("anuncioAfiliados.texto")}</span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
    </Link>
  );
}
