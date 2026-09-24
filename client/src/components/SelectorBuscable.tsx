import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export interface OpcionBuscable {
  valor: string;
  /** Lo que se lee y por lo que se busca. */
  etiqueta: string;
  /** Una segunda línea: el precio, el correo, la obra a la que pertenece. */
  detalle?: string | null;
}

/**
 * Un desplegable en el que se escribe para encontrar.
 *
 * El `Select` normal obliga a bajar por la lista entera. Con cuatro estados da
 * igual; con el catálogo de materiales de un contratista que lleva dos años,
 * o con su lista de clientes, buscar «grifería» a dedo en un móvil es la
 * diferencia entre usar el catálogo y volver a escribir el precio a mano —
 * que es justo lo que el catálogo existe para evitar.
 *
 * ## El buscador aparece solo cuando sirve
 *
 * Por debajo de `DESDE_CUANTAS` opciones no se pinta la caja de búsqueda. En
 * un móvil, un campo de texto abre el teclado y tapa media pantalla: hacer eso
 * para elegir entre cinco cosas estorba más de lo que ayuda.
 *
 * ## Se busca por lo que se lee, y también por el detalle
 *
 * Quien busca un material teclea su nombre; quien busca un cliente puede
 * acordarse antes de su correo que de cómo lo escribió. Así que el filtro mira
 * las dos cosas.
 */
const DESDE_CUANTAS = 8;

export function SelectorBuscable({
  opciones,
  valor,
  onCambio,
  placeholder,
  className,
  disabled,
  "aria-label": etiquetaAria,
}: {
  opciones: OpcionBuscable[];
  valor: string | null | undefined;
  onCambio: (valor: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const elegida = opciones.find((o) => o.valor === valor) ?? null;
  const conBuscador = opciones.length >= DESDE_CUANTAS;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          aria-label={etiquetaAria}
          disabled={disabled}
          className={cn("justify-between font-normal", className)}
        >
          {/* `truncate` y `min-w-0` porque un material puede llamarse
              «Contreplaqué traité sous pression 19 mm» y sin esto empuja el
              botón fuera de la pantalla en un móvil. */}
          <span className={cn("truncate min-w-0", !elegida && "text-muted-foreground")}>
            {elegida?.etiqueta ?? placeholder ?? t("buscador.elegir")}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-56 p-0" align="start">
        <Command>
          {conBuscador && <CommandInput placeholder={t("buscador.escribeParaFiltrar")} />}
          <CommandList>
            <CommandEmpty>{t("buscador.nadaCoincide")}</CommandEmpty>
            <CommandGroup>
              {opciones.map((o) => (
                <CommandItem
                  key={o.valor}
                  // cmdk filtra por este valor, no por el que guardamos: buscar
                  // por un identificador no lo hace nadie.
                  value={`${o.etiqueta} ${o.detalle ?? ""}`}
                  onSelect={() => {
                    onCambio(o.valor);
                    setAbierto(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4 shrink-0", o.valor === valor ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 truncate">{o.etiqueta}</span>
                  {o.detalle && (
                    <span className="ml-auto pl-2 text-xs text-muted-foreground shrink-0">{o.detalle}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
