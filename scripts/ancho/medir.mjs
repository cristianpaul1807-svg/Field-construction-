/**
 * Medir si algo se sale de la pantalla, y decir quién.
 *
 * Aparte porque lo usan dos guardias: `comprobar-ancho.mjs` sobre las páginas
 * públicas y `comprobar-ancho-panel.mjs` sobre el panel. Escrito dos veces
 * acabaría midiendo distinto en cada sitio, y entonces uno de los dos diría
 * que todo está bien cuando no lo está.
 */

import { createRequire } from "node:module";
import { globSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const require = createRequire(import.meta.url);

/**
 * 320 es el iPhone SE, que sigue vivo en obra; 390 es el iPhone normal de
 * ahora. Si cuadra a 320 cuadra en todo lo demás, pero se comprueban los dos
 * porque un `@media` mal puesto puede arreglar uno y romper el otro.
 */
export const ANCHOS = [320, 390];

/** Un píxel de más es redondeo del navegador, no un fallo de maquetación. */
export const TOLERANCIA = 1;

/**
 * Playwright puede estar en tres sitios y ninguno es seguro: como dependencia
 * de otra cosa —y entonces pnpm no lo enlaza arriba y el `import` normal
 * falla—, dentro del almacén de pnpm, o instalado global en la máquina. Se
 * prueban los tres antes de rendirse, porque esto es una comprobación: que no
 * corra por dónde está instalada una herramienta sería el peor motivo para
 * quedarse sin ella.
 */
export function chromium() {
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
 * Qué se sale, si algo se sale.
 *
 * Devuelve `null` cuando cabe. Cuando no, nombra a los culpables **más
 * hondos**: los antecesores se salen sólo porque contienen al que se sale, y
 * listarlos sepulta el dato útil bajo cinco `div` que no hay que tocar.
 */
export async function medir(pagina) {
  return pagina.evaluate((margen) => {
    const cabe = document.documentElement.clientWidth;
    const ocupa = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    if (ocupa - cabe <= margen) return null;

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
