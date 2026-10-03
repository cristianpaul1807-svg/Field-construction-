/**
 * Leer un prezzario regionale como lo publica la región.
 *
 *   node --experimental-strip-types scripts/prueba-italia/prezzario.mjs
 *
 * El Excel se construye aquí, byte a byte, con las costumbres que tienen los
 * de verdad: filas de título encima de la cabecera, textos compartidos, una
 * descripción partida en dos filas, capítulos sin precio y un código
 * repetido. Si el lector se equivoca en algo de eso, el presupuesto sale con
 * un precio o una unidad que no son, y nadie lo nota.
 */

import { deflateRawSync } from "node:zlib";
import { leerCsv, leerXlsx, detectarColumnas, vocesDelPrezzario, leerPrezzo, voceValida } from "../../shared/prezzario.ts";

let bien = 0;
let mal = 0;
function ok(que, real, esperado) {
  const igual = JSON.stringify(real) === JSON.stringify(esperado);
  console.log(`${igual ? "ok " : "MAL"} ${que}${igual ? "" : ` — esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`}`);
  igual ? bien++ : mal++;
}

/* ---------- Precios como vienen escritos ---------- */

ok("Coma decimal italiana", leerPrezzo("12,50"), 12.5);
ok("Miles con punto y decimales con coma", leerPrezzo("1.234,56"), 1234.56);
ok("Con el símbolo del euro", leerPrezzo("€ 1.234,5"), 1234.5);
ok("Punto decimal", leerPrezzo("12.5"), 12.5);
ok("Miles con coma y decimales con punto", leerPrezzo("1,234.56"), 1234.56);
ok("Un número de Excel ya es un número", leerPrezzo(31.456), 31.46);
ok("Un texto que no es un precio no es cero", leerPrezzo("a corpo"), null);
ok("Vacío es sin precio, no gratis", leerPrezzo(""), null);

/* ---------- CSV de Excel en italiano ---------- */

const csv = [
  "﻿Prezzario Regione Lazio 2025;;;",
  ";;;",
  "Codice;Descrizione;Unità di misura;Prezzo €",
  "A03;Scavi e rinterri;;",
  'A03.01.001;"Scavo di sbancamento; eseguito con mezzi meccanici";m³;8,42',
  ";compreso il carico sul mezzo;;",
  "A03.01.002;Scavo a sezione obbligata;m³;14,90",
  "B01;Murature;;",
  "B01.01.003;Muratura in blocchi di laterizio;m²;\"1.045,00\"",
  "B01.01.003;Muratura in blocchi di laterizio (corretta);m²;45,00",
].join("\r\n");
const filasCsv = leerCsv(csv);
const detectado = detectarColumnas(filasCsv);
ok("CSV: encuentra la cabecera debajo del título", detectado?.cabecera, 2);
ok("CSV: y cada columna", detectado?.columnas, { codice: 0, descrizione: 1, unita: 2, prezzo: 3 });
const voces = vocesDelPrezzario(filasCsv, detectado.cabecera, detectado.columnas);
ok("CSV: tres voces, sin los capítulos", voces.map((v) => v.codice), ["A03.01.001", "A03.01.002", "B01.01.003"]);
ok("CSV: el punto y coma dentro de comillas no parte la celda, y la descripción partida se une",
   voces[0].descrizione, "Scavo di sbancamento; eseguito con mezzi meccanici compreso il carico sul mezzo");
ok("CSV: cada voce con su capítulo, su unidad y su precio",
   voces.map((v) => [v.capitolo, v.unita, v.prezzo]),
   [["Scavi e rinterri", "m³", 8.42], ["Scavi e rinterri", "m³", 14.9], ["Murature", "m²", 45]]);
ok("CSV: un código repetido vale la última vez", voces[2].descrizione, "Muratura in blocchi di laterizio (corretta)");

/* ---------- Un .xlsx de verdad ---------- */

function crc32(datos) {
  let c, crc = 0xffffffff;
  for (const b of datos) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(archivos) {
  const locales = [];
  const centrales = [];
  let offset = 0;
  for (const [nombre, contenido, comprimir] of archivos) {
    const datos = Buffer.from(contenido, "utf8");
    const guardado = comprimir ? deflateRawSync(datos) : datos;
    const n = Buffer.from(nombre);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(comprimir ? 8 : 0, 8);
    local.writeUInt32LE(crc32(datos), 14); local.writeUInt32LE(guardado.length, 18); local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(comprimir ? 8 : 0, 10);
    central.writeUInt32LE(crc32(datos), 16); central.writeUInt32LE(guardado.length, 20); central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locales.push(local, n, guardado);
    centrales.push(central, n);
    offset += 30 + n.length + guardado.length;
  }
  const dir = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(dir.length, 12); fin.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locales, dir, fin]));
}

// Una portada en sheet1 y el prezzario en sheet2, que es la primera del libro.
const libro = `<workbook xmlns:r="r"><sheets><sheet name="Elenco" sheetId="2" r:id="rId7"/><sheet name="Copertina" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const rels = `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId7" Target="worksheets/sheet2.xml"/></Relationships>`;
const compartidas = `<sst><si><t>Tariffa</t></si><si><t>Descrizione estesa</t></si><si><t>U.M.</t></si><si><t>Prezzo</t></si><si><r><t>Intonaco civile </t></r><r><rPh><t>ignorar</t></rPh><t xml:space="preserve">a base di calce &amp; cemento</t></r></si><si><t>m²</t></si></sst>`;
const hoja = `<worksheet><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>Regione Toscana — Prezzario 2025</t></is></c></row>
<row r="4"><c r="A4" t="s"><v>0</v></c><c r="B4" t="s"><v>1</v></c><c r="D4" t="s"><v>2</v></c><c r="E4" t="s"><v>3</v></c></row>
<row r="5"><c r="A5" t="str"><v>TOS25_01.E04</v></c><c r="B5" t="inlineStr"><is><t>Intonaci</t></is></c></row>
<row r="6"><c r="A6" t="str"><v>TOS25_01.E04.001.001</v></c><c r="B6" t="s"><v>4</v></c><c r="C6"/><c r="D6" t="s"><v>5</v></c><c r="E6"><v>23.456</v></c></row>
</sheetData></worksheet>`;
const xlsx = zip([
  ["xl/workbook.xml", libro, true],
  ["xl/_rels/workbook.xml.rels", rels, false],
  ["xl/sharedStrings.xml", compartidas, true],
  ["xl/worksheets/sheet1.xml", `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Copertina</t></is></c></row></sheetData></worksheet>`, true],
  ["xl/worksheets/sheet2.xml", hoja, true],
]);
const filasXlsx = await leerXlsx(xlsx);
const enXlsx = detectarColumnas(filasXlsx);
ok("XLSX: lee la primera hoja del libro, no sheet1", String(filasXlsx[0]?.[0]).startsWith("Regione Toscana"), true);
ok("XLSX: la cabecera en la fila 4, con una columna vacía en medio", [enXlsx?.cabecera, enXlsx?.columnas], [3, { codice: 0, descrizione: 1, unita: 3, prezzo: 4 }]);
const vocesXlsx = vocesDelPrezzario(filasXlsx, enXlsx.cabecera, enXlsx.columnas);
ok("XLSX: la voce con su texto rico, sin la fonética y con el & bien",
   vocesXlsx, [{ codice: "TOS25_01.E04.001.001", descrizione: "Intonaco civile a base di calce & cemento", unita: "m²", prezzo: 23.46, capitolo: "Intonaci" }]);

let roto = null;
try { await leerXlsx(new Uint8Array([1, 2, 3, 4])); } catch (e) { roto = e.message; }
ok("Un archivo que no es Excel se dice", roto, "no_es_xlsx");

/* ---------- Lo que acepta el servidor ---------- */

ok("Sin código no entra", voceValida({ codice: " ", descrizione: "x" }), null);
ok("Un precio negativo no entra", voceValida({ codice: "A", descrizione: "x", prezzo: -1 }), null);
ok("Sin precio sí: es una voce de referencia", voceValida({ codice: "A", descrizione: "x", prezzo: null })?.prezzo, null);

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
