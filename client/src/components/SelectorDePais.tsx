import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAISES, OTROS_PAISES, avisoDelPais } from "@shared/paises";
import { correoDeSoporte } from "@/lib/soporte";

/**
 * El nombre del país en el idioma de quien mira.
 *
 * Los que sabemos hacer tienen su clave traducida; los demás los nombra el
 * navegador, que conoce todos los países en todos los idiomas y no hace falta
 * copiar esa tabla cuatro veces.
 */
export function nombreDelPais(codigo: string, idioma: string, t: (k: string) => string): string {
  if (PAISES.some((p) => p.codigo === codigo)) return t(`countries.name.${codigo}`);
  try {
    return new Intl.DisplayNames([idioma], { type: "region" }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

/**
 * Elegir el país del negocio, y saber qué significa elegirlo.
 *
 * Los que sabemos hacer van arriba; los demás debajo, ordenados por su nombre.
 * Elegir uno de los de abajo no se prohíbe —el negocio entra igual y lleva sus
 * obras desde el primer día—, pero se le dice en el momento que su país
 * todavía no tiene la configuración fiscal y a quién escribir, en vez de que
 * lo descubra al intentar su primera factura.
 */
export function SelectorDePais({ valor, onCambio, id }: { valor: string; onCambio: (codigo: string) => void; id?: string }) {
  const { t, i18n } = useTranslation();
  const idioma = i18n.language.slice(0, 2);
  const [soporte, setSoporte] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    correoDeSoporte().then((c) => vivo && setSoporte(c));
    return () => {
      vivo = false;
    };
  }, []);

  const otros = useMemo(
    () =>
      Object.keys(OTROS_PAISES)
        .map((codigo) => ({ codigo, nombre: nombreDelPais(codigo, idioma, t) }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, idioma)),
    [idioma, t]
  );

  const aviso = avisoDelPais(valor);

  return (
    <div className="space-y-2">
      <Select value={valor} onValueChange={onCambio}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{t("registroPais.listos")}</SelectLabel>
            {PAISES.map((p) => (
              <SelectItem key={p.codigo} value={p.codigo}>
                {nombreDelPais(p.codigo, idioma, t)}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>{t("registroPais.otros")}</SelectLabel>
            {otros.map((p) => (
              <SelectItem key={p.codigo} value={p.codigo}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {aviso && (
        <div className="rounded-lg border border-status-warning-fg/30 bg-status-warning-bg/40 p-3 space-y-1.5 text-left">
          <p className="text-xs text-foreground">
            {aviso === "sin_configurar"
              ? t("registroPais.sinConfigurar", { pais: nombreDelPais(valor, idioma, t) })
              : t("registroPais.enPruebas", { pais: nombreDelPais(valor, idioma, t) })}
          </p>
          {soporte && (
            <a href={`mailto:${soporte}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1 break-all">
              <Mail size={12} className="shrink-0" /> {soporte}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
