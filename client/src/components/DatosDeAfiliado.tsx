/**
 * Lo que se pide para entrar en el programa de afiliados, además de la
 * cuenta: cómo se llama, dónde lo va a compartir, dónde vive, y que acepta
 * las condiciones.
 *
 * Aparte porque se pide en dos sitios: en el alta nueva, junto al correo y la
 * contraseña, y a quien ya tiene cuenta (un contratista cliente) y quiere
 * además recomendar.
 */
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectorDePais } from "@/components/SelectorDePais";

export interface Datos {
  nombre: string;
  dondeComparte: string;
  pais: string;
  acepta: boolean;
}

export const datosCompletos = (d: Datos) => d.nombre.trim().length >= 2 && d.dondeComparte.trim().length >= 3 && d.acepta;

export function DatosDeAfiliado({ datos, onCambio }: { datos: Datos; onCambio: (d: Datos) => void }) {
  const { t } = useTranslation();
  const poner = (cambio: Partial<Datos>) => onCambio({ ...datos, ...cambio });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="afiliado-nombre">{t("afiliados.nombre")}</Label>
        <Input id="afiliado-nombre" autoComplete="name" value={datos.nombre} onChange={(e) => poner({ nombre: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="afiliado-donde">{t("afiliados.dondeComparte")}</Label>
        <Textarea
          id="afiliado-donde"
          rows={2}
          value={datos.dondeComparte}
          onChange={(e) => poner({ dondeComparte: e.target.value })}
          placeholder={t("afiliados.dondeCompartePista")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="afiliado-pais">{t("afiliados.pais")}</Label>
        <SelectorDePais id="afiliado-pais" valor={datos.pais} onCambio={(pais) => poner({ pais })} />
      </div>
      {/* Una casilla de verdad, sin marcar de antemano: aceptar es lo que firma
          el contrato, y un sí que viene puesto no es un sí. */}
      <div className="flex items-start gap-2.5">
        <input
          id="afiliado-acepta"
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          checked={datos.acepta}
          onChange={(e) => poner({ acepta: e.target.checked })}
        />
        <label htmlFor="afiliado-acepta" className="text-sm text-foreground leading-snug">
          {t("afiliados.acepto")} ·{" "}
          <Link href="/afiliados/condiciones" className="text-primary underline underline-offset-2">
            {t("afiliados.verCondiciones")}
          </Link>
        </label>
      </div>
    </div>
  );
}
