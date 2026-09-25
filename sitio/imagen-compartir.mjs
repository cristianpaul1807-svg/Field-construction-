/**
 * La imagen que sale cuando alguien pega el enlace en WhatsApp o Facebook.
 *
 *     node sitio/imagen-compartir.mjs
 *
 * Un contratista no llega a esto buscando en Google: se lo pasa otro por el
 * grupo de WhatsApp de la obra. Sin `og:image` el enlace sale como una línea
 * de texto gris que nadie toca, al lado de los de la competencia con su foto.
 *
 * Se genera aquí, una vez, y las cuatro imágenes se guardan en el
 * repositorio. No va dentro de `construir.mjs` porque eso obligaría a tener un
 * navegador para construir, y la construcción corre en el servidor de
 * despliegue, que no lo tiene. Si cambia el titular de la portada, se vuelve a
 * correr esto — el texto sale del mismo `textos/` que la página.
 *
 * 1200×630 es la medida que Facebook, LinkedIn y WhatsApp recortan igual; el
 * texto va dentro del cuadrado central para que la vista cuadrada de WhatsApp
 * no se lo coma.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "../scripts/ancho/medir.mjs";
import fr from "./textos/fr.mjs";
import en from "./textos/en.mjs";
import es from "./textos/es.mjs";
import it from "./textos/it.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const fuente = (f) => `data:font/woff2;base64,${fs.readFileSync(path.join(AQUI, "fuentes", f)).toString("base64")}`;
const logo = `data:image/png;base64,${fs.readFileSync(path.join(AQUI, "logo.png")).toString("base64")}`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const pagina = (t) => `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"><style>
@font-face { font-family: D; font-weight: 800; src: url(${fuente("plus-jakarta-sans-800-latin.woff2")}); }
@font-face { font-family: D; font-weight: 800; src: url(${fuente("plus-jakarta-sans-800-latin-ext.woff2")}); unicode-range: U+0100-02FF; }
@font-face { font-family: T; font-weight: 600; src: url(${fuente("public-sans-600-latin.woff2")}); }
@font-face { font-family: T; font-weight: 600; src: url(${fuente("public-sans-600-latin-ext.woff2")}); unicode-range: U+0100-02FF; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #FFFFFF; color: #0B1220; font-family: T, sans-serif;
  display: flex; flex-direction: column; justify-content: center; padding: 0 96px; position: relative; overflow: hidden; }
body::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 14px; background: #1546A0; }
.marca { display: flex; align-items: center; gap: 18px; font-family: D; font-weight: 800; font-size: 34px; color: #1546A0; margin-bottom: 36px; }
.marca img { width: 64px; height: 64px; }
.sobre { font-weight: 600; font-size: 26px; color: #D9541B; margin-bottom: 14px; }
h1 { font-family: D; font-weight: 800; font-size: 60px; line-height: 1.08; letter-spacing: -0.02em; text-wrap: balance; }
.pie { position: absolute; left: 96px; right: 96px; bottom: 44px; font-weight: 600; font-size: 22px; color: #667585;
  border-top: 2px solid #E2E8F1; padding-top: 20px; display: flex; justify-content: space-between; }
</style></head><body>
<div class="marca"><img src="${logo}" alt="">Logiciel Construction</div>
<div class="sobre">${esc(t.inicio.sobretitulo)}</div>
<h1>${esc(t.inicio.h1)}</h1>
<div class="pie"><span>${esc(t.pie.hecho)}</span><span>logiciel-construction.com</span></div>
</body></html>`;

const nav = await chromium().launch();
const p = await nav.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const t of [fr, en, es, it]) {
  await p.setContent(pagina(t), { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  // Un titular que no cabe es peor que ninguna imagen: se para aquí y no en
  // la vista previa de alguien.
  const sobra = await p.evaluate(() => document.querySelector("h1").getBoundingClientRect().bottom > document.querySelector(".pie").getBoundingClientRect().top - 12);
  if (sobra) throw new Error(`${t.codigo}: el titular pisa el pie`);
  const destino = path.join(AQUI, `compartir-${t.codigo}.png`);
  await p.screenshot({ path: destino });
  console.log(`${path.relative(process.cwd(), destino)}  ${Math.round(fs.statSync(destino).size / 1024)} KB`);
}
await nav.close();
