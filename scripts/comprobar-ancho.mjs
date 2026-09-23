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
import { ANCHOS, chromium, medir } from "./ancho/medir.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SITIO = path.resolve(AQUI, "..", "sitio", "publico");


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
