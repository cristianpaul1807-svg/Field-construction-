/**
 * Lo que un afiliado tiene que saber del país: no el suyo, sino el de las
 * empresas a las que nos recomienda.
 *
 * El afiliado puede vivir donde quiera —es un creador, un contable, un
 * proveedor—, pero sólo gana con empresas de los países que el producto ya
 * sabe hacer: una empresa de Madrid no tendría con qué facturar y no se
 * quedaría. Se lo decimos antes de que pierda el tiempo con ella.
 *
 * La lista sale de `PAISES`: cuando un país nuevo se termina, aparece aquí
 * solo, en el alta y en el panel. Ése es el «te avisaremos en tu panel».
 *
 * Y una cosa de su propio país, sólo si le afecta: si Stripe no paga allí,
 * puede apuntarse, pero no podría cobrar. Mejor saberlo hoy que con 50 $
 * esperando.
 */
import { useTranslation } from "react-i18next";
import { Globe2 } from "lucide-react";
import { PAISES, stripeOperaEn } from "@shared/paises";
import { nombreDelPais } from "@/components/SelectorDePais";

export function MercadosDelPrograma({ paisDelAfiliado, enPanel = false }: { paisDelAfiliado?: string | null; enPanel?: boolean }) {
  const { t, i18n } = useTranslation();
  const idioma = i18n.language.slice(0, 2);
  const nombres = PAISES.filter((p) => !p.enPruebas).map((p) => nombreDelPais(p.codigo, idioma, t));
  let paises = nombres.join(", ");
  try {
    paises = new Intl.ListFormat(idioma, { style: "long", type: "conjunction" }).format(nombres);
  } catch {
    // Un navegador sin ListFormat se queda con las comas.
  }
  const sinStripe = paisDelAfiliado && !stripeOperaEn(paisDelAfiliado);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3 text-left">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Globe2 size={15} className="shrink-0 text-primary" /> {t("afiliados.mercadosTitulo")}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t(enPanel ? "afiliados.mercadosTextoPanel" : "afiliados.mercadosTexto", { paises })}
      </p>
      {sinStripe && (
        <p className="text-xs leading-relaxed text-status-warning-fg">
          {t("afiliados.sinStripe", { pais: nombreDelPais(paisDelAfiliado, idioma, t) })}
        </p>
      )}
    </div>
  );
}
