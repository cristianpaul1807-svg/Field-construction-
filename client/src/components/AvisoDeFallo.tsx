import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, RefreshCw, LifeBuoy, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { abrirAyuda, hayAyuda } from "@/lib/abrirAyuda";
import { correoDeSoporte } from "@/lib/soporte";

/**
 * El aviso de que algo falló.
 *
 * Un fallo sin salida es lo que convierte un problema de cinco minutos en una
 * baja: la persona lee una frase que no entiende, no sabe si perdió lo que
 * escribió, y cierra. Así que este aviso nunca es sólo el aviso — lleva
 * siempre al menos un sitio a donde ir: reintentar, preguntarle a la ayuda, o
 * escribirnos.
 *
 * El texto técnico no se tira. Va plegado detrás de un enlace, porque cuando
 * alguien nos escribe es lo único que sirve para saber qué pasó, y porque
 * pedirlo por correo cuando ya no está en pantalla no lo consigue nunca.
 */
export function AvisoDeFallo({
  mensaje,
  detalle,
  onReintentar,
  seccionDeAyuda = "problemas",
  temaDeAyuda = "avisoDeFallo",
  className,
}: {
  mensaje: string;
  detalle?: string | null;
  /** Si el fallo se puede reintentar sin más. La mayoría sí. */
  onReintentar?: () => void;
  seccionDeAyuda?: string;
  temaDeAyuda?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  // Se mira después de pintar: el bot vive en el marco del panel y en el portal
  // del cliente o en la app del trabajador no está puesto.
  const [conAyuda, setConAyuda] = useState(false);
  useEffect(() => setConAyuda(hayAyuda()), []);
  // Se pone en el despliegue. Sin buzón no se ofrece escribir: un botón que
  // abre un correo a una dirección que no existe es peor que no tenerlo.
  const [soporte, setSoporte] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    correoDeSoporte().then((correo) => {
      if (vivo) setSoporte(correo);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div
      className={`rounded-lg border border-status-error-fg/20 bg-status-error-bg/40 p-4 space-y-3 ${className ?? ""}`}
      role="alert"
    >
      <div className="flex gap-2.5">
        <AlertTriangle size={16} strokeWidth={1.75} className="text-status-error-fg flex-shrink-0 mt-0.5" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">{t("errores.titulo")}</p>
          <p className="text-sm text-muted-foreground">{mensaje}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {onReintentar && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onReintentar}>
            <RefreshCw size={13} strokeWidth={1.75} /> {t("errores.reintentar")}
          </Button>
        )}
        {conAyuda && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => abrirAyuda(seccionDeAyuda, temaDeAyuda)}
          >
            <LifeBuoy size={13} strokeWidth={1.75} /> {t("errores.preguntar")}
          </Button>
        )}
        {soporte && (
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" asChild>
            <a href={`mailto:${soporte}?subject=${encodeURIComponent(t("errores.asuntoCorreo"))}`}>
              <Mail size={13} strokeWidth={1.75} /> {t("errores.escribirnos")}
            </a>
          </Button>
        )}
      </div>

      {detalle && (
        <div>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            onClick={() => setAbierto((x) => !x)}
          >
            <ChevronDown size={11} className={abierto ? "rotate-180 transition-transform" : "transition-transform"} />
            {t("errores.verDetalle")}
          </button>
          {abierto && (
            <p className="mt-1.5 text-[11px] font-mono text-muted-foreground bg-secondary rounded-md px-2.5 py-2 break-words whitespace-pre-wrap">
              {detalle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
