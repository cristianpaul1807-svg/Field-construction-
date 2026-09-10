import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Eye, EyeOff, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * El código de acceso de alguien, para poder volver a dárselo.
 *
 * Antes sólo se veía en el momento de crearlo. Quien lo perdía obligaba a
 * generar otro, y el anterior dejaba de valer — así que si dos personas
 * compartían obra, arreglarle el acceso a una se lo rompía a la otra. En la
 * práctica el jefe acababa apuntando los códigos en un papel, que es peor
 * sitio que este.
 *
 * Nace tapado. No es una contraseña, pero tampoco hace falta que esté a la
 * vista de cualquiera que mire el móvil del encargado por encima del hombro:
 * se enseña cuando se va a usar.
 */
export function AccessCode({ code, className }: { code: string | null; className?: string }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (!code) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{t("technicians.noAccessCode")}</span>;
  }

  const copiar = async () => {
    await navigator.clipboard.writeText(code);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className={cn("flex items-center gap-1.5 min-w-0", className)}>
      <KeyRound size={13} className="text-muted-foreground flex-shrink-0" />
      <code
        className="font-mono text-xs bg-secondary rounded px-1.5 py-1 truncate"
        // Tapado se enseñan puntos, pero el ancho no cambia: así la fila no da
        // un salto al destaparlo.
        title={visible ? code : undefined}
      >
        {visible ? code : "•".repeat(code.length)}
      </code>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 flex-shrink-0"
        aria-label={t(visible ? "technicians.hideCode" : "technicians.showCode")}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 flex-shrink-0"
        aria-label={t("common.copy")}
        onClick={copiar}
      >
        {copiado ? <Check size={14} className="text-status-success-fg" /> : <Copy size={14} />}
      </Button>
    </div>
  );
}
