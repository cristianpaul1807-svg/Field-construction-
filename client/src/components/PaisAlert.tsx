import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { avisoDelPais } from "@shared/paises";
import { correoDeSoporte } from "@/lib/soporte";
import { nombreDelPais } from "@/components/SelectorDePais";

/**
 * Lo que le falta a un negocio por el país en el que está.
 *
 * Quien se registró desde un país que todavía no sabemos hacer entra igual y
 * lleva sus obras, su gente y su agenda. Lo que no puede es facturar: el
 * servidor no emite una factura sin el impuesto de su país. Sin esta tira lo
 * descubriría al intentar la primera, con un error; con ella lo sabe desde el
 * primer día, y sabe a quién escribir.
 *
 * Italia, mientras está en pruebas, tiene su propia frase: allí sí se factura
 * con IVA, y lo que falta es la factura electrónica.
 */
export function PaisAlert() {
  const { t, i18n } = useTranslation();
  const { country } = useAuth();
  const [soporte, setSoporte] = useState<string | null>(null);
  const aviso = avisoDelPais(country);

  useEffect(() => {
    if (!aviso) return;
    let vivo = true;
    correoDeSoporte().then((c) => vivo && setSoporte(c));
    return () => {
      vivo = false;
    };
  }, [aviso]);

  if (!aviso) return null;
  const pais = nombreDelPais(country, i18n.language.slice(0, 2), t);

  return (
    <div className="border-b border-status-warning-fg/30 bg-status-warning-bg/40">
      <div className="px-4 sm:px-8 py-2.5 flex items-start gap-2.5">
        <Globe size={16} strokeWidth={1.75} className="text-foreground mt-0.5 flex-shrink-0" />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            {aviso === "sin_configurar" ? t("paisAviso.sinConfigurarTitulo", { pais }) : t("paisAviso.enPruebasTitulo", { pais })}
          </p>
          <p className="text-xs text-muted-foreground">
            {aviso === "sin_configurar" ? t("paisAviso.sinConfigurarTexto") : t("paisAviso.enPruebasTexto")}
          </p>
          {soporte && (
            <a href={`mailto:${soporte}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1 break-all">
              <Mail size={12} className="shrink-0" /> {soporte}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
