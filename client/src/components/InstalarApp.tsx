import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { alCambiar, caminoDeInstalacion, instalar, type Camino } from "@/lib/instalar";

/**
 * El aviso de que esto se puede instalar en el teléfono.
 *
 * Una PWA no está en ninguna tienda, así que nadie la busca y nadie descubre
 * solo que se puede poner en la pantalla de inicio. Hay que decirlo, y hay que
 * decirlo donde se entra: esta es la puerta por la que pasan el jefe, el
 * trabajador y el cliente.
 *
 * Empieza plegado. Quien viene a entrar a trabajar tiene prisa y esto no es lo
 * que venía a hacer; quien quiera instalarla, la abre.
 *
 * **Si en este navegador no se puede instalar, no se enseñan pasos.** Enseñar
 * «toca Compartir → Añadir a pantalla de inicio» dentro de la ventana de
 * WhatsApp, donde esa opción no existe, es mandar a alguien a buscar un botón
 * que no está — y quedarse convencido de que la aplicación está rota. En su
 * lugar se dice lo único que sí funciona: ábrelo en Safari, con la dirección
 * lista para copiar.
 */
export function InstalarApp() {
  const { t } = useTranslation();
  const [camino, setCamino] = useState<Camino>("ninguno");
  const [abierto, setAbierto] = useState(false);
  const [copiada, setCopiada] = useState(false);

  useEffect(() => {
    const mirar = () => setCamino(caminoDeInstalacion());
    mirar();
    return alCambiar(mirar);
  }, []);

  if (camino === "ninguno") return null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2500);
    } catch {
      // Sin permiso de portapapeles queda el botón de siempre: seleccionar la
      // barra de direcciones a mano. No hay nada que avisar.
    }
  }

  const pasos = [t("instalar.iosPaso1"), t("instalar.iosPaso2"), t("instalar.iosPaso3")];

  return (
    <Card className="p-3 space-y-2">
      <button
        type="button"
        onClick={() => (camino === "boton" ? void instalar() : setAbierto((a) => !a))}
        className="w-full flex items-start gap-2.5 text-left"
        aria-expanded={camino === "boton" ? undefined : abierto}
      >
        <div className="w-8 h-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Smartphone size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground text-xs leading-tight">{t("instalar.titulo")}</h3>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t("instalar.entradilla")}</p>
        </div>
        {camino === "boton" ? (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground">
            <Download size={12} /> {t("instalar.boton")}
          </span>
        ) : (
          <span className="shrink-0 text-[10px] font-medium text-primary">{t("instalar.ver")}</span>
        )}
      </button>

      {abierto && camino === "ios-safari" && (
        <ol className="space-y-1.5 pl-1 pt-1 border-t border-border/80">
          {pasos.map((paso, i) => (
            <li key={paso} className="flex gap-2 text-[11px] text-muted-foreground leading-snug pt-1.5">
              <span className="shrink-0 w-4 h-4 rounded-full bg-muted text-foreground text-[9px] font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="inline-flex items-center gap-1 flex-wrap">
                {i === 0 && <Share size={11} className="text-primary shrink-0" />}
                {paso}
              </span>
            </li>
          ))}
        </ol>
      )}

      {abierto && camino === "ios-otro" && (
        <div className="pt-2 border-t border-border/80 space-y-2">
          <p className="text-[11px] text-muted-foreground leading-snug">{t("instalar.iosOtro")}</p>
          <p className="text-[10px] text-muted-foreground/80 leading-snug">{t("instalar.iosOtroPorque")}</p>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[11px]" onClick={() => void copiar()}>
            {copiada ? <Check size={12} /> : <Copy size={12} />}
            {copiada ? t("instalar.copiada") : t("instalar.copiar")}
          </Button>
        </div>
      )}

      {abierto && camino === "android-otro" && (
        <p className="pt-2 border-t border-border/80 text-[11px] text-muted-foreground leading-snug">
          {t("instalar.androidOtro")}
        </p>
      )}
    </Card>
  );
}
