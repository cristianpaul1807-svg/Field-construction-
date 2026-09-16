/**
 * La pantalla que sale cuando el plan del negocio no incluye esta parte.
 *
 * Aparte del «sin permiso» a propósito, porque no son lo mismo y no se
 * arreglan igual. «No es para ti» lo resuelve quien lleva el negocio dándote
 * acceso; «no lo tienes contratado» lo resuelve el negocio subiendo de plan.
 * Un solo cartel para los dos casos manda a la mitad de la gente a pedirle a
 * su jefe algo que su jefe tampoco puede darle.
 *
 * Y no se escribe como un error, porque no lo es: la pantalla existe, funciona
 * y no está contratada. Se dice qué hace, en qué plan está, y se ofrece lo
 * único que de verdad funciona hoy — escribirnos. En cuanto haya pantalla de
 * suscripción, aquí va el botón que lleva a ella; hasta entonces no se pone un
 * botón que no lleva a ningún sitio.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Mail } from "lucide-react";
import { correoDeSoporte } from "@/lib/soporte";
import { PRECIO, type Capacidad } from "@shared/planes";

export function SinPlan({ capacidad }: { capacidad: Capacidad }) {
  const { t } = useTranslation();
  const [soporte, setSoporte] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    correoDeSoporte().then((c) => vivo && setSoporte(c));
    return () => {
      vivo = false;
    };
  }, []);

  const precio = PRECIO.entreprise;

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <Card className="p-6 sm:p-8 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
            <Lock size={20} className="text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground">
              {t(`planes.capacidad.${capacidad}.titulo`)}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {t(`planes.capacidad.${capacidad}.cuerpo`)}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-secondary/40 p-4">
          <p className="text-sm text-foreground">
            {precio
              ? t("planes.estaEnEntreprisePrecio", { precio: precio.mes, moneda: precio.moneda })
              : t("planes.estaEnEntreprise")}
          </p>
        </div>

        {soporte && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button asChild className="gap-2">
              <a href={`mailto:${soporte}?subject=${encodeURIComponent(t("planes.asuntoCorreo"))}`}>
                <Mail size={15} strokeWidth={1.75} />
                {t("planes.escribenos")}
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">{t("planes.loActivamos")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
