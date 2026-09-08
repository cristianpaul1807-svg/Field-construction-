import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

/**
 * Lo que falta antes de poder hacer esto, dicho y con la puerta abierta.
 *
 * Casi todo en esta aplicación cuelga de tener un cliente: el presupuesto es
 * para alguien, la factura se le cobra a alguien, la obra es de alguien. En un
 * negocio recién abierto no hay ninguno, y los diálogos de crear se abrían con
 * el desplegable vacío —sin una sola línea de texto— y el botón deshabilitado
 * para siempre. Desde fuera eso no se distingue de una aplicación rota, y así
 * es exactamente como lo describió el primer contratista que la usó.
 *
 * La regla de la casa dice que un control que no hace nada es peor que no
 * tener control: si algo no puede funcionar, se dice por qué y se ofrece lo
 * que sí funciona.
 */
export function NeedsFirst({
  message,
  href,
  cta,
  onNavigate,
}: {
  message: string;
  href: string;
  cta: string;
  /** Para cerrar el diálogo que lo contiene antes de navegar. */
  onNavigate?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-3">
      <p className="text-sm text-foreground">{message}</p>
      <Link href={href} onClick={onNavigate}>
        <Button size="sm" className="gap-2">
          {cta} <ArrowRight size={14} strokeWidth={1.75} />
        </Button>
      </Link>
    </div>
  );
}
