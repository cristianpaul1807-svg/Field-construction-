/**
 * Que la pantalla de consentimiento del MCP hable los cuatro idiomas.
 *
 *   node --experimental-strip-types scripts/prueba-mcp/idiomas.mjs
 *
 * Existe porque esa pantalla se quedó en castellano fijo durante todo el
 * proyecto sin que nada lo dijera. La regla de la casa es que todo texto
 * visible pasa por `t()`, y el guardia de idiomas compara las cuatro tablas de
 * `client/src/i18n/locales` — pero esta pantalla la pinta el servidor en HTML
 * suelto, fuera de React y fuera de i18next. No había `t()` que faltara ni
 * clave que descuadrara: simplemente no la miraba nadie.
 *
 * Y es la **única** pantalla del producto donde alguien escribe una
 * contraseña. A un carpintero de Quebec le salía en español.
 *
 * Así que se comprueban dos cosas: que las tablas estén completas, y que la
 * pantalla no vuelva a llevar texto pegado dentro.
 */

import { readFileSync } from "node:fs";
import { TEXTOS_MCP, AVISOS_MCP, IDIOMAS_MCP, langDelMcp } from "../../server/mcpTextos.ts";

let bien = 0;
let mal = 0;
function ok(que, real, esperado) {
  const igual = JSON.stringify(real) === JSON.stringify(esperado);
  console.log(`${igual ? "ok " : "MAL"} ${que}${igual ? "" : ` — esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`}`);
  igual ? bien++ : mal++;
}

const IDIOMAS = ["es", "en", "fr", "it"];

/* ---------- Las tablas, completas y sin huecos ---------- */

ok("Están los cuatro idiomas", Object.keys(TEXTOS_MCP).sort(), [...IDIOMAS].sort());
ok("Y el selector los ofrece todos", IDIOMAS_MCP.map((i) => i.codigo).sort(), [...IDIOMAS].sort());

const claves = (o) => Object.keys(o).sort();
for (const idioma of IDIOMAS) {
  ok(`«${idioma}» tiene las mismas claves que el francés`, claves(TEXTOS_MCP[idioma]), claves(TEXTOS_MCP.fr));
}

const vacias = [];
for (const idioma of IDIOMAS) {
  for (const [clave, valor] of Object.entries(TEXTOS_MCP[idioma])) {
    const texto = typeof valor === "function" ? valor("X") : valor;
    if (!String(texto).trim()) vacias.push(`${idioma}.${clave}`);
  }
}
ok("Ningún texto vacío", vacias, []);

const avisosIncompletos = Object.entries(AVISOS_MCP)
  .filter(([, porIdioma]) => IDIOMAS.some((i) => !porIdioma[i]?.trim()))
  .map(([codigo]) => codigo);
ok("Cada aviso existe en los cuatro idiomas", avisosIncompletos, []);

/* ---------- Que no sean el mismo texto copiado ---------- */

/**
 * Cuatro tablas con las mismas claves se pueden rellenar copiando el
 * castellano cuatro veces y todo lo de arriba pasa. Esto lo coge.
 */
const repetidos = [];
for (const clave of claves(TEXTOS_MCP.fr)) {
  const textos = IDIOMAS.map((i) => {
    const v = TEXTOS_MCP[i][clave];
    return typeof v === "function" ? v("X") : v;
  });
  if (new Set(textos).size === 1) repetidos.push(clave);
}
ok("Ningún texto es idéntico en los cuatro idiomas", repetidos, []);

/* ---------- De qué idioma se parte ---------- */

ok("Manda lo que la persona elige a mano", langDelMcp("it", "fr-CA,fr;q=0.9"), "it");
ok("Si no elige, lo que pide su navegador", langDelMcp(undefined, "fr-CA,fr;q=0.9,en;q=0.8"), "fr");
ok("El inglés de un navegador inglés", langDelMcp("", "en-CA,en;q=0.9"), "en");
ok("Un idioma que no hablamos no cuela", langDelMcp("de", "de-DE,de;q=0.9"), "fr");
ok("Sin nada, francés: es el mercado y es la Loi 96", langDelMcp(undefined, undefined), "fr");

/* ---------- Que la pantalla no lleve texto pegado ---------- */

const fuente = readFileSync(new URL("../../server/mcpOAuth.ts", import.meta.url), "utf8");
const pantalla = fuente.slice(fuente.indexOf("function consentPage"), fuente.indexOf("async function authorizeGet"));

/**
 * Palabras que sólo pueden aparecer dentro de una tabla de idiomas. Si alguna
 * vuelve a la plantilla es que alguien escribió texto a mano otra vez.
 */
const pegadas = ["Contraseña", "Código de acceso", "Conectar con Claude", "Conectando", "Introduce el", "propietaria", "solicita conectarse"]
  .filter((palabra) => pantalla.includes(palabra));
ok("La plantilla no lleva castellano dentro", pegadas, []);

ok("El idioma del documento sale del idioma elegido", pantalla.includes('<html lang="${lang}"'), true);
ok("Y el selector se pinta", pantalla.includes("IDIOMAS_MCP.map"), true);

/**
 * Cambiar de idioma no puede costar la autorización: el enlace tiene que
 * llevar el `state` y el `code_challenge`, o al volver Claude rechaza la
 * respuesta y la persona sólo ve que no funciona.
 */
const enlace = fuente.slice(fuente.indexOf("function enlaceDeIdioma"), fuente.indexOf("function baseUrl"));
for (const parametro of ["state", "code_challenge", "redirect_uri", "client_id", "resource"]) {
  ok(`El enlace de idioma conserva ${parametro}`, enlace.includes(`"${parametro}"`), true);
}

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
