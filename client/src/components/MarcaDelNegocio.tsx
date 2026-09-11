import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

/**
 * El logotipo del negocio, donde toca enseñar de quién es esto.
 *
 * Hay dos reglas y no son la misma, por eso el recurso se dice a propósito:
 *
 * - **Dentro del panel** (`recurso="plataforma"`): si el negocio tiene
 *   logotipo, el suyo; si todavía no, el nuestro. Un hueco gris en la esquina
 *   de su propia herramienta el primer día no ayuda a nadie.
 *
 * - **Hacia fuera** (`recurso="inicial"`): el portal del cliente, el chat
 *   público, cualquier cosa que vea alguien que no es el negocio. Ahí el
 *   nuestro no pinta nada: el cliente entra a ver a su contratista, y poner
 *   nuestra marca sería hacerle creer que el trabajo lo hace otro. Sin
 *   logotipo se enseña su inicial, que al menos es suya.
 *
 * Los PDF no pasan por aquí: los compone el servidor y allí no hay recurso
 * ninguno — sin logotipo del negocio, el membrete se queda en texto.
 */
export function MarcaDelNegocio({
  logoUrl,
  name,
  size = 32,
  recurso,
  className,
}: {
  logoUrl: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  recurso: "plataforma" | "inicial";
  className?: string;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name ?? ""}
        width={size}
        height={size}
        className={cn("rounded-lg border border-border/50 object-cover bg-card", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  if (recurso === "plataforma") {
    return <Logo size={size} className={cn("rounded-lg", className)} />;
  }

  return (
    <div
      className={cn(
        "rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center flex-shrink-0",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      aria-hidden
    >
      {(name ?? "?").trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}
