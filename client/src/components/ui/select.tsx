import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { useTranslation } from "react-i18next";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Desde cuántas opciones aparece el buscador.
 *
 * Por debajo no se pinta: en un móvil un campo de texto abre el teclado y tapa
 * media pantalla, y hacer eso para elegir entre cinco cosas estorba más de lo
 * que ayuda. Ocho es donde deja de caber la lista de un vistazo.
 */
const DESDE_CUANTAS = 8;

/** El texto de una opción, sea cual sea su dibujo por dentro. */
function textoDe(nodo: React.ReactNode): string {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoDe).join(" ");
  if (React.isValidElement(nodo)) return textoDe((nodo.props as { children?: React.ReactNode }).children);
  return "";
}

/**
 * Sin tildes y en minúsculas, para que «griferia» encuentre «Grifería».
 *
 * Quien escribe deprisa en una obra no pone los acentos, y un buscador que
 * exige escribirlos bien no es un buscador.
 */
const normal = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      // w-full rather than the upstream w-fit: every select in this product
      // sits in a form row, and sizing to the content meant a long option
      // ("Al confirmar el trabajo", a client's full company name) pushed the
      // control out over whatever sat beside it. Call sites that want a
      // specific width still pass one and it wins.
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/**
 * El contenido de un desplegable, con buscador cuando la lista es larga.
 *
 * Va aquí y no en cada pantalla a propósito. Hay 44 desplegables con listas de
 * datos en el producto: convertirlos uno a uno serían 44 ocasiones de romper
 * algo y, en los que pintan precio o icono dentro de cada opción, se perdería
 * ese dibujo. Puesto en la pieza base, lo heredan todos y ninguno cambia.
 *
 * El filtro mira el **texto** de cada opción, así que da igual cómo esté
 * dibujada por dentro: si la opción enseña «Grifería · 12,00 $», se encuentra
 * escribiendo cualquiera de los dos.
 */
function SelectContent({
  className,
  children,
  position = "popper",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  const { t } = useTranslation();
  const [filtro, setFiltro] = React.useState("");
  const caja = React.useRef<React.ComponentRef<typeof SelectPrimitive.Content> | null>(null);

  /** Las opciones que se ven ahora mismo, en el orden en que se leen. */
  const visiblesEnPantalla = () =>
    Array.from(caja.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);

  const sueltos = React.Children.toArray(children);
  const cuantas = sueltos.reduce<number>((n, hijo) => {
    if (!React.isValidElement(hijo)) return n;
    if (hijo.type === SelectItem) return n + 1;
    if (hijo.type === SelectGroup) {
      return n + React.Children.toArray((hijo.props as { children?: React.ReactNode }).children).filter(
        (x) => React.isValidElement(x) && x.type === SelectItem
      ).length;
    }
    return n;
  }, 0);
  const conBuscador = cuantas >= DESDE_CUANTAS;

  const pasa = (hijo: React.ReactNode) => !filtro || normal(textoDe(hijo)).includes(normal(filtro));

  const filtrar = (nodos: React.ReactNode[]): React.ReactNode[] =>
    nodos.flatMap((hijo) => {
      if (!React.isValidElement(hijo)) return [hijo];
      if (hijo.type === SelectItem) return pasa(hijo) ? [hijo] : [];
      if (hijo.type === SelectGroup) {
        const dentro = filtrar(React.Children.toArray((hijo.props as { children?: React.ReactNode }).children));
        // Un grupo que se queda sin opciones se va con ellas: dejar su título
        // solo haría pensar que hay algo debajo.
        const quedan = dentro.some((x) => React.isValidElement(x) && x.type === SelectItem);
        return quedan ? [React.cloneElement(hijo as React.ReactElement<{ children?: React.ReactNode }>, {}, dentro)] : [];
      }
      return [hijo];
    });

  const visibles = conBuscador ? filtrar(sueltos) : sueltos;
  const hayAlguna = visibles.some(
    (x) => React.isValidElement(x) && (x.type === SelectItem || x.type === SelectGroup)
  );

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={caja}
        data-slot="select-content"
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        align={align}
        {...props}
      >
        {conBuscador && (
          <div className="sticky top-0 z-10 bg-popover p-1 pb-0">
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              // Radix se queda con las teclas sueltas para su propio salto por
              // letra inicial, así que escribir aquí movía la selección en vez
              // de filtrar. Se le cortan sólo los caracteres; las flechas, el
              // Enter y el Escape siguen subiendo para que el teclado navegue
              // y cierre como siempre.
              onKeyDown={(e) => {
                // Con el foco dentro de la caja, Radix deja de mover la
                // selección: su teclado vive en las opciones, no aquí. Sin
                // estas dos teclas se podía filtrar pero no elegir sin tocar
                // la pantalla, que es dejar fuera a quien va por teclado.
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  visiblesEnPantalla()[0]?.focus();
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  visiblesEnPantalla()[0]?.click();
                  return;
                }
                // El resto de caracteres son para escribir aquí, no para el
                // salto por letra inicial de Radix.
                if (e.key.length === 1 || e.key === "Backspace") e.stopPropagation();
              }}
              placeholder={t("buscador.escribeParaFiltrar")}
              aria-label={t("buscador.escribeParaFiltrar")}
              className="w-full rounded-sm border border-input bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1"
          )}
        >
          {visibles}
          {conBuscador && !hayAlguna && (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">{t("buscador.nadaCoincide")}</p>
          )}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
