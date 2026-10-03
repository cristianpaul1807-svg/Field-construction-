/**
 * Leer un prezzario regionale: el archivo tal como lo publica la región.
 *
 * Cada región lo publica a su manera —Excel con tres filas de título encima,
 * CSV con punto y coma y la coma decimal, columnas que se llaman «Tariffa»,
 * «Codice» o «Art.»—, así que aquí no se supone nada: se busca la fila de
 * cabecera, se adivinan las columnas y la pantalla deja corregirlas antes de
 * cargar.
 *
 * Sin librerías: un `.xlsx` es un zip con XML dentro, y el navegador ya sabe
 * descomprimir (`DecompressionStream`). La librería de Excel conocida tiene
 * fallos de seguridad sin arreglar en npm, y meterla para leer cuatro
 * columnas no compensaba.
 *
 * Funciona igual en el navegador y en node, que es donde lo prueba
 * `scripts/prueba-italia/prezzario.mjs`.
 */

export type Celda = string | number | null;
export type Fila = Celda[];

/** Lo que se guarda de cada voce. */
export interface VoceDelPrezzario {
  codice: string;
  descrizione: string;
  unita: string | null;
  prezzo: number | null;
  capitolo: string | null;
}

export interface Columnas {
  codice: number;
  descrizione: number;
  unita: number | null;
  prezzo: number | null;
}

/** Más que esto no es un prezzario, es otra cosa, y no se carga a ciegas. */
export const MAX_VOCI = 60_000;
/** Las que se mandan al servidor de cada vez. */
export const VOCI_POR_ENVIO = 1000;

/* ---------- CSV ---------- */

/**
 * El separador lo decide la primera línea con contenido: en Italia el CSV
 * sale de Excel con punto y coma, porque la coma es la de los decimales.
 */
export function leerCsv(texto: string): Fila[] {
  const limpio = texto.replace(/^﻿/, "");
  const primera = limpio.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const cuenta = (c: string) => primera.split(c).length - 1;
  const separador = [";", "\t", ","].reduce((mejor, c) => (cuenta(c) > cuenta(mejor) ? c : mejor), ";");

  const filas: Fila[] = [];
  let fila: Fila = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          celda += '"';
          i++;
        } else entreComillas = false;
      } else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === separador) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  if (celda !== "" || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

/* ---------- XLSX ---------- */

async function inflar(datos: Uint8Array): Promise<Uint8Array> {
  const flujo = new Blob([datos as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/** Los archivos de un zip, sin descomprimir todavía. */
function entradasDelZip(zip: Uint8Array): Map<string, () => Promise<Uint8Array>> {
  const vista = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // El directorio central se encuentra desde el final: su registro de cierre
  // está en los últimos 64 KB (22 bytes más un comentario opcional).
  let fin = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (vista.getUint32(i, true) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error("no_es_xlsx");
  const total = vista.getUint16(fin + 10, true);
  let p = vista.getUint32(fin + 16, true);
  const decodificador = new TextDecoder();
  const entradas = new Map<string, () => Promise<Uint8Array>>();
  for (let n = 0; n < total; n++) {
    if (vista.getUint32(p, true) !== 0x02014b50) throw new Error("no_es_xlsx");
    const metodo = vista.getUint16(p + 10, true);
    const comprimido = vista.getUint32(p + 20, true);
    const largoNombre = vista.getUint16(p + 28, true);
    const largoExtra = vista.getUint16(p + 30, true);
    const largoComentario = vista.getUint16(p + 32, true);
    const local = vista.getUint32(p + 42, true);
    const nombre = decodificador.decode(zip.subarray(p + 46, p + 46 + largoNombre));
    entradas.set(nombre, async () => {
      const inicio = local + 30 + vista.getUint16(local + 26, true) + vista.getUint16(local + 28, true);
      const bruto = zip.subarray(inicio, inicio + comprimido);
      if (metodo === 0) return bruto;
      if (metodo === 8) return inflar(bruto);
      throw new Error("no_es_xlsx");
    });
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return entradas;
}

function desescapar(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** El texto de un `<si>` o un `<is>`, que puede venir troceado en `<r>` con formato. */
function textoDe(xml: string): string {
  // `<rPh>` es la lectura fonética japonesa: no es parte del texto.
  const sinFonetica = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  return desescapar(Array.from(sinFonetica.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((m) => m[1]).join(""));
}

function columnaDe(ref: string): number {
  let n = 0;
  for (const c of ref.replace(/\d+$/, "").toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/** La primera hoja del libro, como filas de celdas. */
export async function leerXlsx(datos: Uint8Array): Promise<Fila[]> {
  const entradas = entradasDelZip(datos);
  const texto = async (nombre: string) => {
    const leer = entradas.get(nombre);
    return leer ? new TextDecoder().decode(await leer()) : null;
  };

  // La primera hoja según el libro, no según el nombre del archivo: un
  // prezzario con una portada delante tiene la portada en sheet1.
  let hoja = "xl/worksheets/sheet1.xml";
  const libro = await texto("xl/workbook.xml");
  const relaciones = await texto("xl/_rels/workbook.xml.rels");
  const primera = libro?.match(/<sheet\b[^>]*\br:id="([^"]+)"/);
  if (primera && relaciones) {
    const rel = Array.from(relaciones.matchAll(/<Relationship\b[^>]*>/g)).map((m) => m[0]).find((r) => r.includes(`Id="${primera[1]}"`));
    const destino = rel?.match(/Target="([^"]+)"/)?.[1];
    if (destino) hoja = destino.startsWith("/") ? destino.slice(1) : `xl/${destino}`;
  }

  const compartidas = Array.from(((await texto("xl/sharedStrings.xml")) ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)).map((m) => textoDe(m[1]));
  const xml = await texto(hoja);
  if (xml === null) throw new Error("no_es_xlsx");

  const filas: Fila[] = [];
  for (const fila of Array.from(xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g))) {
    const numero = Number(fila[1].match(/\br="(\d+)"/)?.[1] ?? filas.length + 1);
    const celdas: Fila = [];
    for (const c of Array.from(fila[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g))) {
      const atributos = c[1];
      const ref = atributos.match(/\br="([A-Z]+\d+)"/)?.[1];
      const tipo = atributos.match(/\bt="([^"]+)"/)?.[1];
      const dentro = c[2] ?? "";
      const v = dentro.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let valor: Celda = null;
      if (tipo === "s") valor = v !== undefined ? compartidas[Number(v)] ?? null : null;
      else if (tipo === "inlineStr") valor = textoDe(dentro);
      else if (tipo === "str" || tipo === "e") valor = v !== undefined ? desescapar(v) : null;
      else if (tipo === "b") valor = v === "1" ? "TRUE" : "FALSE";
      else if (v !== undefined) valor = Number(v);
      celdas[ref ? columnaDe(ref) : celdas.length] = valor;
    }
    filas[numero - 1] = Array.from(celdas, (x) => x ?? null);
  }
  return Array.from(filas, (f) => f ?? []);
}

/* ---------- Columnas y voces ---------- */

const PATRONES: Record<keyof Columnas, RegExp> = {
  codice: /^(cod(ice)?|n\.?\s*(di\s*)?tariffa|tariffa|art(icolo)?\.?|voce|code|n\.?\s*voce)(?![a-z])/i,
  descrizione: /descri|denominaz|declaratoria|designaz|description/i,
  unita: /^(u\.?\s*m\.?|u\.?\s*d\.?\s*m\.?|unit[aà]|um|misura|unit)(?![a-z])/i,
  prezzo: /prezzo|importo|€|euro|price|costo/i,
};

/** La fila de cabecera y qué columna es cada cosa, buscadas en las primeras filas. */
export function detectarColumnas(filas: Fila[]): { cabecera: number; columnas: Columnas } | null {
  let mejor: { cabecera: number; columnas: Partial<Columnas>; aciertos: number } | null = null;
  for (let i = 0; i < Math.min(filas.length, 40); i++) {
    const columnas: Partial<Columnas> = {};
    (filas[i] ?? []).forEach((celda, j) => {
      const texto = String(celda ?? "").trim();
      if (!texto) return;
      for (const clave of Object.keys(PATRONES) as (keyof Columnas)[]) {
        if (columnas[clave] === undefined && PATRONES[clave].test(texto)) {
          columnas[clave] = j;
          break;
        }
      }
    });
    const aciertos = Object.keys(columnas).length;
    if (columnas.codice !== undefined && columnas.descrizione !== undefined && (!mejor || aciertos > mejor.aciertos)) {
      mejor = { cabecera: i, columnas, aciertos };
    }
  }
  if (!mejor) return null;
  return {
    cabecera: mejor.cabecera,
    columnas: {
      codice: mejor.columnas.codice!,
      descrizione: mejor.columnas.descrizione!,
      unita: mejor.columnas.unita ?? null,
      prezzo: mejor.columnas.prezzo ?? null,
    },
  };
}

/**
 * Un precio tal como viene escrito. Un número de Excel ya es un número; un
 * texto puede ser «1.234,56», «€ 12,50» o «12.5». Con los dos separadores, el
 * último es el decimal; con sólo una coma, es la coma decimal italiana.
 */
export function leerPrezzo(valor: Celda): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) && valor >= 0 ? Math.round(valor * 100) / 100 : null;
  let s = valor.replace(/[€\s ]|eur(o)?/gi, "");
  if (!s) return null;
  const coma = s.lastIndexOf(",");
  const punto = s.lastIndexOf(".");
  if (coma >= 0 && punto >= 0) s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (coma >= 0) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s) * 100) / 100;
}

const texto = (c: Celda | undefined) => (c === null || c === undefined ? "" : String(c).replace(/\s+/g, " ").trim());

/**
 * Las voces del archivo. Dos costumbres de los prezzari que hay que entender
 * para no cargar basura:
 *
 * - **Una fila con código y sin precio ni unidad es un capítulo** («A.01 —
 *   Scavi e rinterri»). No se guarda como voce —no se puede presupuestar—,
 *   pero su título acompaña a las voces que tiene debajo.
 * - **Una fila sin código, sólo con texto, sigue la descripción de la voce
 *   de arriba**: la región partió una descripción larga en varias filas.
 *
 * Si un código sale dos veces, vale la última: así se puede volver a cargar
 * el mismo archivo corregido.
 */
export function vocesDelPrezzario(filas: Fila[], cabecera: number, columnas: Columnas): VoceDelPrezzario[] {
  const voces = new Map<string, VoceDelPrezzario>();
  let capitolo: string | null = null;
  let anterior: VoceDelPrezzario | null = null;
  for (let i = cabecera + 1; i < filas.length; i++) {
    const fila = filas[i] ?? [];
    const codice = texto(fila[columnas.codice]).slice(0, 80);
    const descrizione = texto(fila[columnas.descrizione]);
    const unita = columnas.unita === null ? "" : texto(fila[columnas.unita]).slice(0, 20);
    const prezzo = columnas.prezzo === null ? null : leerPrezzo(fila[columnas.prezzo] ?? null);
    if (!codice) {
      if (anterior && descrizione && !unita && prezzo === null) anterior.descrizione = `${anterior.descrizione} ${descrizione}`.slice(0, 4000);
      continue;
    }
    if (!descrizione) continue;
    if (!unita && prezzo === null) {
      capitolo = descrizione.slice(0, 300);
      anterior = null;
      continue;
    }
    anterior = { codice, descrizione: descrizione.slice(0, 4000), unita: unita || null, prezzo, capitolo };
    voces.delete(codice);
    voces.set(codice, anterior);
  }
  return Array.from(voces.values());
}

/** Lo que el servidor acepta de una voce que le llega. */
export function voceValida(v: unknown): VoceDelPrezzario | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const codice = typeof o.codice === "string" ? o.codice.trim().slice(0, 80) : "";
  const descrizione = typeof o.descrizione === "string" ? o.descrizione.trim().slice(0, 4000) : "";
  if (!codice || !descrizione) return null;
  const prezzo = o.prezzo === null || o.prezzo === undefined ? null : Number(o.prezzo);
  if (prezzo !== null && (!Number.isFinite(prezzo) || prezzo < 0 || prezzo > 1e10)) return null;
  const unita = typeof o.unita === "string" && o.unita.trim() ? o.unita.trim().slice(0, 20) : null;
  const capitolo = typeof o.capitolo === "string" && o.capitolo.trim() ? o.capitolo.trim().slice(0, 300) : null;
  return { codice, descrizione, unita, prezzo: prezzo === null ? null : Math.round(prezzo * 100) / 100, capitolo };
}
