import { cn } from "@/lib/utils";

/**
 * La marca del producto.
 *
 * Existe para que la ruta del archivo esté escrita en un solo sitio: el logo
 * vive en los iconos de la PWA, y cuando cambie —ya ha cambiado una vez— basta
 * con reemplazar los PNG y esto sigue apuntando donde debe.
 *
 * Se usa el de 180 px y no el de 192: es el mismo dibujo, pesa la mitad, y a
 * los tamaños a los que se enseña aquí (48 px como mucho) sobra de largo.
 *
 * No confundir con el logo del negocio, que es `businesses.logo_url` y es de
 * cada cliente. Este es el nuestro.
 */
export function Logo({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/icons/apple-touch-icon.png"
      alt="Logiciel - Construction"
      width={size}
      height={size}
      // El dibujo viene sobre blanco, así que en modo oscuro necesita el borde
      // para no quedar como un recorte flotando sobre el fondo.
      className={cn("rounded-xl border border-border/50 object-cover shadow-sm", className)}
      style={{ width: size, height: size }}
    />
  );
}
