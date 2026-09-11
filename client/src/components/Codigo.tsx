import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Un código que una persona lee en voz alta y copia: el número de obra, el de
 * una factura.
 *
 * Va en monoespaciada —donde la O y el 0 no se confunden— y con un botón de
 * copiar al lado. Sin él se transcribe a mano, y ahí es donde nacen los
 * números que no coinciden con nada.
 *
 * Lo que no tiene código no se inventa uno: se dice que no lo tiene. Pasa con
 * las citas sueltas, que no son trabajo de obra y por eso no llevan número.
 */
export function Codigo({
  code,
  className,
  copiable = true,
  emptyLabel,
}: {
  code: string | null;
  className?: string;
  copiable?: boolean;
  /** Qué poner cuando no hay código. Por defecto, el de un trabajo sin número. */
  emptyLabel?: string;
}) {
  const { t } = useTranslation();
  const [copiado, setCopiado] = useState(false);

  if (!code) {
    return <span className={cn("text-xs italic text-muted-foreground", className)}>{emptyLabel ?? t("workLog.noCommessa")}</span>;
  }

  const copiar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await navigator.clipboard.writeText(code);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}>
      <code className="font-mono text-xs font-semibold tracking-tight whitespace-nowrap bg-secondary text-foreground rounded px-1.5 py-0.5">
        {code}
      </code>
      {copiable && (
        <button
          type="button"
          onClick={copiar}
          aria-label={t("common.copy")}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          {copiado ? <Check size={12} className="text-status-success-fg" /> : <Copy size={12} />}
        </button>
      )}
    </span>
  );
}
