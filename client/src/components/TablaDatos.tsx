import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Search, ArrowUp, ArrowDown, Download, Columns3, FileSpreadsheet, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { apiFetch, serverMessage } from "@/lib/api";
import { useSelectedProject } from "@/contexts/SelectedProjectContext";

/**
 * Qué clase de dato hay en la columna. Decide tres cosas a la vez: cómo se
 * pinta, cómo se ordena y si se puede sumar. Tenerlo en un sitio evita que la
 * misma columna se alinee de una forma en una tabla y de otra en la de al lado.
 */
export type TipoColumna = "texto" | "numero" | "dinero" | "horas" | "fecha" | "codigo";

export interface Columna<T> {
  id: string;
  cabecera: string;
  /** El valor en crudo. De aquí salen el orden, la búsqueda y el CSV. */
  valor: (fila: T) => string | number | null;
  tipo?: TipoColumna;
  /** Cómo se ve en pantalla, si no basta con el valor en crudo. */
  pintar?: (fila: T) => React.ReactNode;
  /** Las columnas de dinero y de horas suman en el pie. */
  sumable?: boolean;
  /** Nace escondida; se enseña desde el menú de columnas. */
  ocultaAlInicio?: boolean;
}

interface Props<T> {
  filas: T[] | null;
  columnas: Columna<T>[];
  cargando?: boolean;
  error?: string | null;
  clave: (fila: T) => string;
  alPulsar?: (fila: T) => void;
  /** Nombre del archivo al exportar, sin extensión. */
  nombreExport: string;
  /** Cómo se llama esta tabla en el papel. */
  titulo: string;
  vacio?: string;
}

function formatoNumero(v: number, idioma: string) {
  return v.toLocaleString(idioma, { maximumFractionDigits: 2 });
}

function formatoDinero(v: number, idioma: string) {
  return v.toLocaleString(idioma, { style: "currency", currency: "CAD", maximumFractionDigits: 2 });
}

/** Horas decimales dichas como las diría una persona: 7,5 → "7 h 30". */
function formatoHoras(v: number) {
  if (!v) return "—";
  const h = Math.floor(v);
  const m = Math.round((v - h) * 60);
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Una tabla de datos, de las que se miran como se mira una hoja de cálculo:
 * muchas filas, columnas que se ordenan, y la posibilidad de sacarlo todo a
 * un archivo para trabajarlo fuera.
 *
 * Vive aquí y no dentro de cada pantalla porque si no, cada tabla acaba
 * ordenando distinto, exportando distinto y alineando los números al lado
 * contrario. Lo que cambia de una a otra son las columnas; el resto es igual.
 */
export function TablaDatos<T>({
  filas,
  columnas,
  cargando,
  error,
  clave,
  alPulsar,
  nombreExport,
  titulo,
  vacio,
}: Props<T>) {
  const { t, i18n } = useTranslation();
  const { selectedProject } = useSelectedProject();
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<{ id: string; desc: boolean } | null>(null);
  const [ocultas, setOcultas] = useState<Set<string>>(
    () => new Set(columnas.filter((c) => c.ocultaAlInicio).map((c) => c.id))
  );

  const visibles = columnas.filter((c) => !ocultas.has(c.id));

  // Sin acentos: media plantilla de Quebec se llama Gagné y quien busca
  // escribe "gagne" con el teclado que tenga a mano.
  const sinAcentos = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const procesadas = useMemo(() => {
    let out = filas ?? [];
    const aguja = sinAcentos(busqueda.trim());
    if (aguja) {
      out = out.filter((f) =>
        visibles.some((c) => {
          const v = c.valor(f);
          return v !== null && sinAcentos(String(v)).includes(aguja);
        })
      );
    }
    if (orden) {
      const col = columnas.find((c) => c.id === orden.id);
      if (col) {
        const numerica = col.tipo === "numero" || col.tipo === "dinero" || col.tipo === "horas";
        out = [...out].sort((a, b) => {
          const va = col.valor(a);
          const vb = col.valor(b);
          // Lo vacío al final siempre, se ordene como se ordene: una fila sin
          // dato no es "la más pequeña", es una fila a la que le falta algo.
          if (va === null && vb === null) return 0;
          if (va === null) return 1;
          if (vb === null) return -1;
          const cmp = numerica
            ? Number(va) - Number(vb)
            : String(va).localeCompare(String(vb), i18n.language, { numeric: true });
          return orden.desc ? -cmp : cmp;
        });
      }
    }
    return out;
  }, [filas, busqueda, orden, columnas, ocultas, i18n.language]);

  const totales = useMemo(() => {
    const out = new Map<string, number>();
    for (const c of visibles) {
      if (!c.sumable) continue;
      out.set(c.id, procesadas.reduce((s, f) => s + (Number(c.valor(f)) || 0), 0));
    }
    return out;
  }, [procesadas, ocultas]);

  const exportar = () => {
    const escapa = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    // Lo que va al archivo no es siempre lo que va a la pantalla. Una fecha en
    // ISO con hora y zona entra en Excel como texto y no se puede ordenar ni
    // filtrar; en AAAA-MM-DD la reconoce en cualquier idioma. Y los decimales
    // van con la coma o el punto que use quien abre la hoja, porque un Excel
    // en francés lee "14.5" como texto y deja de sumar.
    const paraCsv = (c: Columna<T>, f: T) => {
      const v = c.valor(f);
      if (v === null || v === "") return "";
      if (c.tipo === "fecha") {
        const d = new Date(String(v));
        return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
      }
      if (c.tipo === "numero" || c.tipo === "dinero" || c.tipo === "horas") {
        // Sin separador de millares: con él, el número vuelve a ser texto.
        return Number(v).toLocaleString(i18n.language, { useGrouping: false, maximumFractionDigits: 2 });
      }
      return String(v);
    };
    // Punto y coma, no coma: Excel en francés y en español abre el CSV por
    // columnas con ";" y mete todo en una sola celda con ",".
    const lineas = [
      visibles.map((c) => escapa(c.cabecera)).join(";"),
      ...procesadas.map((f) => visibles.map((c) => escapa(paraCsv(c, f))).join(";")),
    ];
    // El BOM es lo que hace que Excel lea el archivo como UTF-8. Sin él,
    // "Gagné" se abre como "GagnÃ©" y el jefe cree que el dato está mal.
    const blob = new Blob(["\uFEFF" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    descargar(blob, `${nombreExport}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const descargar = (blob: Blob, nombre: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * El PDF lo compone el servidor porque el membrete es suyo: nombre,
   * logotipo, licencia RBQ y números fiscales salen del negocio de la sesión
   * y no de lo que diga el navegador. De aquí sólo van la tabla y sus
   * columnas, ya formateadas en el idioma de quien exporta.
   */
  const exportarPdf = async () => {
    setExportando(true);
    setErrorExport(null);
    try {
      const res = await apiFetch(`/api/export/pdf?lang=${i18n.language.slice(0, 2)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titulo,
          // De qué obra es lo que se está enseñando. Sin esto, dos informes
          // del mismo día no se distinguen al archivarlos.
          scope: selectedProject ? `${t("scope.label")} ${selectedProject.name}` : null,
          columns: visibles.map((c) => ({ label: c.cabecera, align: alineaDerecha(c) ? "right" : "left" })),
          rows: procesadas.map((f) => visibles.map((c) => textoDeCelda(c, f))),
          totals: totales.size > 0 ? filaDeTotales() : null,
        }),
      });
      if (!res.ok) {
        throw new Error(serverMessage(await res.json().catch(() => null), t, t("tabla.errorPdf")));
      }
      descargar(await res.blob(), `${nombreExport}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      setErrorExport(err instanceof Error ? err.message : t("tabla.errorPdf"));
    } finally {
      setExportando(false);
    }
  };

  /**
   * La celda como texto, tal y como se lee en pantalla.
   *
   * No es lo mismo que lo que va al CSV: ahí los números van en crudo para
   * que Excel los sume, y aquí van con su moneda y sus horas en "8 h 30",
   * porque un papel se lee, no se recalcula.
   */
  const textoDeCelda = (c: Columna<T>, f: T): string => {
    const v = c.valor(f);
    if (v === null || v === "") return "";
    if (c.tipo === "dinero") return formatoDinero(Number(v), i18n.language);
    if (c.tipo === "numero") return formatoNumero(Number(v), i18n.language);
    if (c.tipo === "horas") return formatoHoras(Number(v));
    if (c.tipo === "fecha") {
      const d = new Date(String(v));
      return Number.isNaN(d.getTime())
        ? String(v)
        : d.toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "2-digit" });
    }
    return String(v);
  };

  /** La misma fila de totales que se ve al pie, en texto. */
  const filaDeTotales = (): string[] =>
    visibles.map((c, i) => {
      if (i === 0) return t("tabla.filas", { count: procesadas.length });
      if (!totales.has(c.id)) return "";
      const total = totales.get(c.id)!;
      return c.tipo === "dinero"
        ? formatoDinero(total, i18n.language)
        : c.tipo === "horas"
          ? formatoHoras(total)
          : formatoNumero(total, i18n.language);
    });

  const pintarCelda = (c: Columna<T>, f: T) => {
    if (c.pintar) return c.pintar(f);
    const v = c.valor(f);
    if (v === null || v === "") return <span className="text-muted-foreground">—</span>;
    if (c.tipo === "dinero") return formatoDinero(Number(v), i18n.language);
    if (c.tipo === "numero") return formatoNumero(Number(v), i18n.language);
    if (c.tipo === "horas") return formatoHoras(Number(v));
    if (c.tipo === "fecha")
      return new Date(String(v)).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "2-digit" });
    if (c.tipo === "codigo") return <span className="font-mono text-xs whitespace-nowrap">{String(v)}</span>;
    return String(v);
  };

  const alineaDerecha = (c: Columna<T>) =>
    c.tipo === "numero" || c.tipo === "dinero" || c.tipo === "horas";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[12rem]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t("tabla.buscar")}
            className="pl-9"
            aria-label={t("tabla.buscar")}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Columns3 size={14} /> {t("tabla.columnas")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t("tabla.columnasVisibles")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columnas.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={!ocultas.has(c.id)}
                onCheckedChange={(v) =>
                  setOcultas((prev) => {
                    const next = new Set(prev);
                    // La última columna no se puede esconder: una tabla sin
                    // columnas no enseña nada y no se sabe cómo recuperarla.
                    if (!v && prev.size >= columnas.length - 1) return prev;
                    if (v) next.delete(c.id);
                    else next.add(c.id);
                    return next;
                  })
                }
              >
                {c.cabecera}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dos cosas distintas y por eso dos opciones: el CSV se abre en
            Excel para trabajarlo, el PDF lleva el membrete de la empresa y
            es lo que se entrega o se archiva. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={procesadas.length === 0 || exportando}>
              {exportando ? <Spinner className="size-3.5" /> : <Download size={14} />} {t("tabla.exportar")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onClick={exportar} className="gap-2">
              <FileSpreadsheet size={15} className="flex-shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm">{t("tabla.exportarCsv")}</p>
                <p className="text-xs text-muted-foreground">{t("tabla.exportarCsvHint")}</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportarPdf} className="gap-2">
              <FileText size={15} className="flex-shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm">{t("tabla.exportarPdf")}</p>
                <p className="text-xs text-muted-foreground">{t("tabla.exportarPdfHint")}</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {errorExport && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-3 text-sm text-status-error-fg">
          {errorExport}
        </div>
      )}

      {cargando && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          {t("common.loadError", { message: error })}
        </div>
      )}

      {!cargando && !error && (
        // Una tabla es de las pocas cosas que pueden ser más anchas que la
        // pantalla, siempre que se desplace dentro de su caja y no arrastre
        // la página entera.
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-secondary/60 sticky top-0">
              <tr>
                {visibles.map((c) => {
                  const activa = orden?.id === c.id;
                  return (
                    <th
                      key={c.id}
                      scope="col"
                      className={cn(
                        "text-left font-medium text-muted-foreground whitespace-nowrap px-3 py-2 border-b border-border",
                        alineaDerecha(c) && "text-right"
                      )}
                    >
                      <button
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() =>
                          setOrden((prev) =>
                            prev?.id === c.id ? (prev.desc ? null : { id: c.id, desc: true }) : { id: c.id, desc: false }
                          )
                        }
                        aria-label={t("tabla.ordenarPor", { columna: c.cabecera })}
                      >
                        {c.cabecera}
                        {activa && (orden!.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {procesadas.map((f) => (
                <tr
                  key={clave(f)}
                  onClick={alPulsar ? () => alPulsar(f) : undefined}
                  className={cn(
                    "border-b border-border last:border-0",
                    alPulsar && "cursor-pointer hover:bg-secondary/40 transition-colors"
                  )}
                >
                  {visibles.map((c) => (
                    <td
                      key={c.id}
                      className={cn("px-3 py-2 align-top text-foreground", alineaDerecha(c) && "text-right tabular-nums whitespace-nowrap")}
                    >
                      {pintarCelda(c, f)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {totales.size > 0 && procesadas.length > 0 && (
              /* Los totales son de lo que se está viendo, filtro incluido: si
                 filtras por un cliente, el total es el de ese cliente. */
              <tfoot>
                <tr className="bg-secondary/40 font-semibold">
                  {visibles.map((c, i) => (
                    <td key={c.id} className={cn("px-3 py-2 whitespace-nowrap", alineaDerecha(c) && "text-right tabular-nums")}>
                      {i === 0
                        ? t("tabla.filas", { count: procesadas.length })
                        : totales.has(c.id)
                          ? c.tipo === "dinero"
                            ? formatoDinero(totales.get(c.id)!, i18n.language)
                            : c.tipo === "horas"
                              ? formatoHoras(totales.get(c.id)!)
                              : formatoNumero(totales.get(c.id)!, i18n.language)
                          : null}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>

          {procesadas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              {busqueda.trim() ? t("tabla.sinCoincidencias", { query: busqueda.trim() }) : (vacio ?? t("tabla.vacia"))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
