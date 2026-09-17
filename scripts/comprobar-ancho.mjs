/**
 * Ninguna página del sitio puede salirse de ancho en un teléfono.
 *
 *   node scripts/comprobar-ancho.mjs
 *
 * El sitio lo va a abrir un contratista con el móvil en la furgoneta. Si algo
 * mide más que la pantalla, el navegador deja la página arrastrable de lado:
 * el texto se sale, hay que empujar a izquierda y derecha para leer una línea,
 * y todo parece roto aunque cada pieza por separado esté bien.
 *
 * No es un error que se vea escribiendo CSS ni que atrape `tsc`. Se ve
 * abriendo las páginas y midiéndolas, así que eso es lo que hace esto: abre
 * las 28 a los anchos de teléfono más pequeños que se usan de verdad y
 * compara lo que ocupa el documento con lo que cabe en la pantalla.
 *
 * Cuando algo se sale, además dice **qué** se sale. Saber que la portada mide
 * 480 px de ancho no sirve de nada; saber que quien la estira es el botón de
 * la cabecera sí.
 *
 * ## Por qué levanta un servidor y no abre los archivos
 *
 * Los enlaces del sitio son absolutos —`/sitio/estilo.css`, `/fr/tarifs`—
 * porque así es como se sirven en producción. Abiertos con `file://` esos
 * caminos apuntan a la raíz del disco: el navegador no encuentra la hoja de
 * estilos, pinta el HTML desnudo, y todo cabe de sobra porque no hay nada que
 * se salga. La primera versión de esta comprobación hacía justo eso y decía
 * que todo estaba bien mientras la cabecera se salía en el teléfono.
 *
 * Por eso mide contra un servidor de verdad y **exige que las fuentes hayan
 * cargado**. Un tipo de letra distinto es un ancho distinto: medir con la
 * letra de reserva es volver a medir una página que nadie va a ver.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { globSync } from "node:fs";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SITIO = path.resolve(AQUI, "..", "sitio", "publico");

/**
 * Playwright puede estar en tres sitios y ninguno es seguro: como dependencia
 * de otra cosa —y entonces pnpm no lo enlaza arriba y el `import` normal
 * falla—, dentro del almacén de pnpm, o instalado global en la máquina. Se
 * prueban los tres antes de rendirse, porque esto es una comprobación: que no
 * corra por dónde está instalada una herramienta sería el peor motivo para
 * quedarse sin ella.
 */
function chromium() {
  const intentos = [
    () => require("playwright"),
    () => {
      const [dir] = globSync("node_modules/.pnpm/playwright@*/node_modules/playwright");
      return dir ? require(path.resolve(dir)) : null;
    },
    () => require(path.join(execSync("npm root -g", { encoding: "utf-8" }).trim(), "playwright")),
  ];

  for (const intento of intentos) {
    try {
      const modulo = intento();
      if (modulo?.chromium) return modulo.chromium;
    } catch {
      // El siguiente sitio.
    }
  }

  console.error("Playwright no está en ningún sitio. Instálalo: pnpm add -D playwright");
  process.exit(1);
}

/**
 * 320 es el iPhone SE, que sigue vivo en obra; 390 es el iPhone normal de
 * ahora. Si cuadra a 320 cuadra en todo lo demás, pero se comprueban los dos
 * porque un `@media` mal puesto puede arreglar uno y romper el otro.
 */
const ANCHOS = [320, 390];

/** Un píxel de más es redondeo del navegador, no un fallo de maquetación. */
const TOLERANCIA = 1;

/** Las dos familias que pide `estilo.css`. Si no están, no se mide. */
const FUENTES = [
  ['800 18px "Plus Jakarta Sans"', "Plus Jakarta Sans"],
  ['500 16px "Public Sans"', "Public Sans"],
];

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

/** El mismo reparto que hace `server/index.ts`, en veinte líneas. */
function servidor(mapa) {
  const rutas = new Map(mapa.map((r) => [r.ruta, r.fichero]));
  return http.createServer((req, res) => {
    const camino = new URL(req.url, "http://x").pathname;
    const fichero = rutas.get(camino) ?? (camino.startsWith("/sitio/") ? camino.slice("/sitio/".length) : camino.slice(1));
    const destino = path.join(SITIO, fichero);
    if (!destino.startsWith(SITIO) || !fs.existsSync(destino) || fs.statSync(destino).isDirectory()) {
      res.writeHead(404).end("no");
      return;
    }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(destino)] ?? "application/octet-stream" });
    res.end(fs.readFileSync(destino));
  });
}

async function medir(pagina) {
  return pagina.evaluate((margen) => {
    const cabe = document.documentElement.clientWidth;
    const ocupa = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    if (ocupa - cabe <= margen) return null;

    // Quién se sale. Se descartan los antecesores del culpable —que se salen
    // sólo porque lo contienen— quedándose con los elementos más hondos.
    const culpables = [];
    for (const el of document.querySelectorAll("body *")) {
      const caja = el.getBoundingClientRect();
      if (caja.width === 0 && caja.height === 0) continue;
      if (caja.right <= cabe + margen && caja.left >= -margen) continue;
      if (getComputedStyle(el).position === "fixed") continue;
      culpables.push(el);
    }
    const hondos = culpables.filter((el) => !culpables.some((otro) => otro !== el && el.contains(otro)));

    const describir = (el) => {
      const caja = el.getBoundingClientRect();
      const clase = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : "";
      const texto = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()}${clase} [${Math.round(caja.left)}→${Math.round(caja.right)}] ${texto}`;
    };

    return { ocupa, cabe, quien: hondos.slice(0, 6).map(describir) };
  }, TOLERANCIA);
}

/**
 * `document.fonts.check` contesta que sí cuando no hay nada cargado, porque
 * responde por la letra de reserva. Lo que no miente es la lista: si ninguna
 * cara de la familia llegó, la familia no está.
 */
async function fuentesCargadas(pagina) {
  await pagina.evaluate(() => document.fonts.ready);
  return pagina.evaluate(
    (familias) => familias.filter(([, nombre]) => ![...document.fonts].some((f) => f.family === nombre && f.status === "loaded")).map(([, nombre]) => nombre),
    FUENTES,
  );
}

async function main() {
  const mapa = JSON.parse(fs.readFileSync(path.join(SITIO, "rutas.json"), "utf-8"));
  const srv = servidor(mapa);
  await new Promise((listo) => srv.listen(0, "127.0.0.1", listo));
  const base = `http://127.0.0.1:${srv.address().port}`;

  const navegador = await chromium().launch();
  const fallos = [];
  let miradas = 0;
  let comprobadasLasFuentes = false;

  for (const ancho of ANCHOS) {
    const contexto = await navegador.newContext({
      viewport: { width: ancho, height: 800 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const pagina = await contexto.newPage();

    for (const { ruta } of mapa) {
      await pagina.goto(base + ruta, { waitUntil: "load" });

      if (!comprobadasLasFuentes) {
        const faltan = await fuentesCargadas(pagina);
        if (faltan.length) {
          console.error(`No cargaron las fuentes (${faltan.join(", ")}). Medir con la letra de reserva daría un ancho que nadie va a ver.`);
          await navegador.close();
          srv.close();
          process.exit(1);
        }
        comprobadasLasFuentes = true;
      }

      // Las tarjetas entran con un observador de scroll: sin esto se miden
      // mientras están desplazadas, que es un ancho que nadie ve nunca.
      await pagina.evaluate(() => {
        document.querySelectorAll(".aparece").forEach((el) => el.classList.add("visible"));
        return document.fonts.ready;
      });

      miradas += 1;
      const mal = await medir(pagina);
      if (mal) {
        fallos.push(`  · ${ruta} a ${ancho}px — ocupa ${Math.round(mal.ocupa)} y caben ${mal.cabe}\n` + mal.quien.map((q) => `      ${q}`).join("\n"));
      }
    }

    await contexto.close();
  }

  await navegador.close();
  srv.close();

  if (fallos.length) {
    console.error("Páginas que se salen de ancho en el móvil:\n" + fallos.join("\n"));
    process.exit(1);
  }
  console.log(`ancho ok — ${miradas} vistas con las fuentes de verdad, ninguna se sale en ${ANCHOS.join(" ni ")} px`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
