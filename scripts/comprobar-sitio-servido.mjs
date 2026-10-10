/**
 * Que cada archivo que enlaza el sitio lo sirva de verdad el servidor de producción.
 *
 *   node scripts/comprobar-sitio-servido.mjs      (después de `npm run build`)
 *
 * Existe por las capturas de la portada. `construir.mjs` comprobaba que cada
 * imagen enlazada estaba en el disco, y `comprobar-ancho.mjs` las veía bien
 * porque monta su propio servidor. Pero el de producción, `server/index.ts`,
 * sólo tenía rutas para el CSS, el logo y las fuentes: `/sitio/capturas/…`
 * caía en el `*` final y contestaba con el `index.html` de la aplicación, un
 * 200 que el navegador pinta como imagen rota. Todo en verde, y en el móvil
 * del dueño cuatro recuadros vacíos donde tenía que estar el producto.
 *
 * Así que aquí se arranca `dist/index.js` tal cual y se le pide cada
 * `/sitio/…` que aparezca en una página. Falla si no es un 200 o si lo que
 * vuelve es HTML: un CSS, una foto o una letra no son nunca una página.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVIDOR = path.join(RAIZ, "dist", "index.js");
const PAGINAS = path.join(RAIZ, "dist", "sitio");

if (!fs.existsSync(SERVIDOR) || !fs.existsSync(PAGINAS)) {
  console.error("No hay build que probar. Corre `npm run build` antes.");
  process.exit(1);
}

function htmlDe(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? htmlDe(p) : e.name.endsWith(".html") ? [p] : [];
  });
}

const enlazados = new Set();
for (const pagina of htmlDe(PAGINAS)) {
  const html = fs.readFileSync(pagina, "utf8");
  for (const m of html.matchAll(/(?:src|href)="(\/sitio\/[^"#?]+)/g)) enlazados.add(m[1]);
}
// Lo que pide el CSS (las letras) también va por el servidor.
const css = fs.readFileSync(path.join(PAGINAS, "estilo.css"), "utf8");
for (const m of css.matchAll(/url\(["']?(\/sitio\/[^"')?#]+)/g)) enlazados.add(m[1]);

const puerto = await new Promise((ok) => {
  const s = net.createServer().listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => ok(p));
  });
});

const hijo = spawn(process.execPath, [SERVIDOR], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(puerto), NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
let salida = "";
hijo.stdout.on("data", (d) => (salida += d));
hijo.stderr.on("data", (d) => (salida += d));

const base = `http://127.0.0.1:${puerto}`;
let listo = false;
for (let i = 0; i < 100 && !listo; i++) {
  await new Promise((r) => setTimeout(r, 150));
  listo = await fetch(`${base}/sitio/estilo.css`).then(() => true, () => false);
}
if (!listo) {
  hijo.kill();
  console.error("El servidor de producción no arrancó:\n" + salida.slice(-2000));
  process.exit(1);
}

const mal = [];
for (const ruta of [...enlazados].sort()) {
  const res = await fetch(base + ruta);
  const tipo = res.headers.get("content-type") ?? "";
  await res.arrayBuffer();
  if (res.status !== 200) mal.push(`${ruta} → ${res.status}`);
  else if (tipo.startsWith("text/html")) mal.push(`${ruta} → contesta una página HTML, no el archivo`);
}
hijo.kill();

if (mal.length) {
  console.error(`\nEl servidor de producción no sirve ${mal.length} de ${enlazados.size} archivos del sitio:\n`);
  console.error(mal.map((m) => `  · ${m}`).join("\n"));
  console.error("\nEn la web eso es una imagen rota, una letra que no carga o una página sin estilo. Añade la ruta en server/index.ts.\n");
  process.exit(1);
}
console.log(`sitio servido ok — ${enlazados.size} archivos enlazados, todos los sirve el servidor de producción`);
