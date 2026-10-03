import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileSpreadsheet, Search, Trash2, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvisoDeFallo } from "@/components/AvisoDeFallo";
import { apiEnviar, apiFetch, readJson, useApi } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/mockData";
import {
  detectarColumnas,
  leerCsv,
  leerXlsx,
  MAX_VOCI,
  vocesDelPrezzario,
  VOCI_POR_ENVIO,
  type Columnas,
  type Fila,
} from "@shared/prezzario";

/**
 * El prezzario regionale: cargarlo desde el archivo de la región y buscar en él.
 *
 * Sólo se monta en negocios italianos (`paisDe(country).prezzario`); el
 * servidor y la base lo rechazan igual en cualquier otro. Ver
 * docs/funciones/prezzario.md.
 */

interface Fonte {
  fonte: string;
  voci: number;
  aggiornato: string;
}

export interface VoceElegida {
  fonte: string;
  codice: string;
  descrizione: string;
  unita: string | null;
  prezzo: number | null;
  capitolo: string | null;
}

/** Un CSV de Excel en Windows no es UTF-8: si lo parece y no lo es, salen «Unit�». */
function textoDelArchivo(datos: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(datos);
  } catch {
    return new TextDecoder("windows-1252").decode(datos);
  }
}

const letra = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

export function PrezzarioRegionale() {
  const { t, i18n } = useTranslation();
  const { data, loading, error, detalle, reload } = useApi<{ fonti: Fonte[] }>("/api/prezzario");
  const entrada = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [falloAlLeer, setFalloAlLeer] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<{ nombre: string; filas: Fila[]; cabecera: number; columnas: Columnas } | null>(null);
  const [fonte, setFonte] = useState("");
  const [cargadas, setCargadas] = useState<{ hechas: number; total: number } | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const voci = useMemo(
    () => (archivo ? vocesDelPrezzario(archivo.filas, archivo.cabecera, archivo.columnas) : []),
    [archivo]
  );

  const elegirArchivo = async (file: File) => {
    setFalloAlLeer(null);
    setHecho(null);
    setLeyendo(true);
    try {
      const bytes = await file.arrayBuffer();
      const esExcel = /\.xlsx$/i.test(file.name);
      const filas = esExcel ? await leerXlsx(new Uint8Array(bytes)) : leerCsv(textoDelArchivo(bytes));
      const detectado = detectarColumnas(filas);
      setArchivo({
        nombre: file.name,
        filas,
        cabecera: detectado?.cabecera ?? 0,
        columnas: detectado?.columnas ?? { codice: 0, descrizione: 1, unita: 2, prezzo: 3 },
      });
      setFonte(file.name.replace(/\.(xlsx|csv|txt)$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 120));
    } catch {
      setFalloAlLeer(t("prezzario.noSeLee"));
      setArchivo(null);
    } finally {
      setLeyendo(false);
    }
  };

  const cargar = async () => {
    if (!archivo || !voci.length || !fonte.trim()) return;
    setCargadas({ hechas: 0, total: voci.length });
    try {
      for (let i = 0; i < voci.length; i += VOCI_POR_ENVIO) {
        const lote = voci.slice(i, i + VOCI_POR_ENVIO);
        const res = await apiEnviar("/api/prezzario/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fonte: fonte.trim(), voci: lote }),
        });
        await readJson(res);
        setCargadas({ hechas: Math.min(i + lote.length, voci.length), total: voci.length });
      }
      setHecho(t("prezzario.cargadas", { n: formatNumber(voci.length), fonte: fonte.trim() }));
      setArchivo(null);
      reload();
    } catch {
      // apiEnviar ya lo ha dicho en pantalla; lo cargado hasta ahí queda, y
      // volver a cargar el archivo no duplica nada.
    } finally {
      setCargadas(null);
    }
  };

  const borrar = async (f: string) => {
    if (!window.confirm(t("prezzario.borrarConfirm", { fonte: f }))) return;
    const res = await apiEnviar(`/api/prezzario/fonte?fonte=${encodeURIComponent(f)}`, { method: "DELETE" });
    await readJson(res);
    reload();
  };

  const cabecera = archivo?.filas[archivo.cabecera] ?? [];
  const ancho = archivo ? Math.max(...archivo.filas.slice(archivo.cabecera, archivo.cabecera + 30).map((f) => f.length), cabecera.length) : 0;
  const opcionesColumna = Array.from({ length: ancho }, (_, i) => ({
    valor: String(i),
    texto: `${letra(i)}${cabecera[i] !== null && cabecera[i] !== undefined && String(cabecera[i]).trim() ? ` · ${String(cabecera[i]).trim().slice(0, 30)}` : ""}`,
  }));
  const ponerColumna = (clave: keyof Columnas, valor: string) =>
    setArchivo((a) => (a ? { ...a, columnas: { ...a.columnas, [clave]: valor === "ninguna" ? null : Number(valor) } } : a));

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <FileSpreadsheet size={18} strokeWidth={1.75} /> {t("prezzario.titulo")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t("prezzario.entradilla")}</p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0" onClick={() => entrada.current?.click()} disabled={leyendo || cargadas !== null}>
          {leyendo ? <Spinner className="size-4" /> : <Upload size={16} strokeWidth={1.75} />} {t("prezzario.cargarArchivo")}
        </Button>
        <input
          ref={entrada}
          type="file"
          accept=".xlsx,.csv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void elegirArchivo(f);
          }}
        />
      </div>

      {falloAlLeer && <p className="text-sm text-status-error-fg">{falloAlLeer}</p>}
      {hecho && <p className="text-sm text-status-success-fg">{hecho}</p>}

      {archivo && (
        <div className="rounded-lg border border-border p-3 sm:p-4 space-y-3">
          <p className="text-sm font-medium text-foreground break-words">{archivo.nombre}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(["codice", "descrizione", "unita", "prezzo"] as const).map((clave) => (
              <div key={clave} className="space-y-1 min-w-0">
                <Label className="text-xs">{t(`prezzario.columna.${clave}`)}</Label>
                <Select value={archivo.columnas[clave] === null ? "ninguna" : String(archivo.columnas[clave])} onValueChange={(v) => ponerColumna(clave, v)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(clave === "unita" || clave === "prezzo") && <SelectItem value="ninguna">{t("prezzario.ninguna")}</SelectItem>}
                    {opcionesColumna.map((o) => (
                      <SelectItem key={o.valor} value={o.valor}>
                        {o.texto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="prezzario-fonte">{t("prezzario.nombreFonte")}</Label>
            <Input id="prezzario-fonte" value={fonte} maxLength={120} onChange={(e) => setFonte(e.target.value)} placeholder={t("prezzario.nombreFontePista")} className="h-8" />
          </div>

          {voci.length === 0 ? (
            <p className="text-sm text-status-warning-fg">{t("prezzario.ningunaVoce")}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("prezzario.encontradas", { n: formatNumber(voci.length) })}</p>
              <ul className="space-y-1.5 text-sm">
                {voci.slice(0, 3).map((v) => (
                  <li key={v.codice} className="rounded-md bg-secondary/60 px-2.5 py-1.5 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground break-all">{v.codice}</span>
                    <span className="block text-foreground line-clamp-2 break-words">{v.descrizione}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.unita ?? t("prezzario.sinUnidad")} · {v.prezzo === null ? t("prezzario.sinPrecio") : formatCurrency(v.prezzo)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {voci.length > MAX_VOCI && <p className="text-sm text-status-error-fg">{t("prezzario.demasiadas", { max: formatNumber(MAX_VOCI) })}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={cargar} disabled={!voci.length || voci.length > MAX_VOCI || !fonte.trim() || cargadas !== null} className="gap-2">
              {cargadas ? <Spinner className="size-4" /> : null}
              {cargadas
                ? t("prezzario.cargando", { hechas: formatNumber(cargadas.hechas), total: formatNumber(cargadas.total) })
                : t("prezzario.cargarN", { n: formatNumber(voci.length) })}
            </Button>
            <Button variant="ghost" onClick={() => setArchivo(null)} disabled={cargadas !== null}>
              {t("common.cancel")}
            </Button>
            {!fonte.trim() && <span className="text-xs text-muted-foreground">{t("prezzario.faltaNombre")}</span>}
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-4 text-muted-foreground"><Spinner className="size-5" /></div>}
      {error && <AvisoDeFallo mensaje={t("prezzario.noCarga")} detalle={detalle} onReintentar={reload} />}
      {!loading && !error && (
        (data?.fonti ?? []).length === 0 ? (
          !archivo && <p className="text-sm text-muted-foreground">{t("prezzario.vacio")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {(data?.fonti ?? []).map((f) => (
              <li key={f.fonte} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground break-words">{f.fonte}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("prezzario.vociDe", { n: formatNumber(f.voci) })} · {new Date(f.aggiornato).toLocaleDateString(i18n.language)}
                  </span>
                </span>
                <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={() => borrar(f.fonte)} aria-label={t("prezzario.borrar", { fonte: f.fonte })}>
                  <Trash2 size={15} />
                </Button>
              </li>
            ))}
          </ul>
        )
      )}
      <p className="text-xs text-muted-foreground">{t("prezzario.notaPrecios")}</p>
    </Card>
  );
}

/**
 * Buscar una voce para una línea del presupuesto. Cada palabra tiene que
 * aparecer: «intonaco calce» encuentra la voce aunque entre las dos haya diez.
 */
export function BuscadorDelPrezzario({ onElegir }: { onElegir: (v: VoceElegida) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [voci, setVoci] = useState<VoceElegida[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setVoci(null);
      return;
    }
    let vigente = true;
    const espera = setTimeout(async () => {
      setBuscando(true);
      setFallo(false);
      try {
        const res = await apiFetch(`/api/prezzario/voci?q=${encodeURIComponent(q.trim())}`);
        const cuerpo = await readJson<{ voci?: VoceElegida[] }>(res);
        if (!vigente) return;
        if (!res.ok) setFallo(true);
        setVoci(res.ok ? cuerpo?.voci ?? [] : []);
      } catch {
        if (vigente) setFallo(true);
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("prezzario.buscarPista")} className="pl-8" aria-label={t("prezzario.buscar")} />
      </div>
      {buscando && <div className="flex justify-center py-2 text-muted-foreground"><Spinner className="size-4" /></div>}
      {fallo && <p className="text-sm text-status-error-fg">{t("prezzario.noBusca")}</p>}
      {voci && !buscando && voci.length === 0 && !fallo && <p className="text-sm text-muted-foreground">{t("prezzario.nadaEncontrado", { menu: t("nav.materials") })}</p>}
      {voci && voci.length > 0 && (
        <ul className="max-h-80 overflow-y-auto space-y-1.5">
          {voci.map((v) => (
            <li key={`${v.fonte}|${v.codice}`}>
              <button type="button" onClick={() => onElegir(v)} className="w-full text-left rounded-md border border-border px-2.5 py-2 hover:bg-secondary/70 min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                  <span className="font-mono break-all">{v.codice}</span>
                  <span className="break-words">{v.fonte}</span>
                </span>
                <span className="block text-sm text-foreground line-clamp-3 break-words">{v.descrizione}</span>
                <span className="text-xs font-medium text-foreground">
                  {v.prezzo === null ? t("prezzario.sinPrecio") : formatCurrency(v.prezzo)}
                  {v.unita ? ` / ${v.unita}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t("prezzario.notaPrecios")}</p>
    </div>
  );
}
