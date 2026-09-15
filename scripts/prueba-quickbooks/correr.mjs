import esbuild from "esbuild";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../..");

// Se compila el módulo de verdad; lo único que se sustituye es la puerta de
// salida hacia Intuit. Probar una copia del código no probaría nada.
const doble = {
  name: "doble",
  setup(build) {
    // `external: true` es lo que importa: si se empaqueta, el espía acaba
    // duplicado —uno dentro del paquete y otro fuera— y las llamadas se
    // graban en la copia que nadie mira.
    build.onResolve({ filter: /\.\/quickbooks$/ }, () => ({ path: "./stub-quickbooks.js", external: true }));
  },
};

await esbuild.build({
  entryPoints: [path.join(RAIZ, "server/quickbooksSync.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: path.join(AQUI, "sync.mjs"),
  plugins: [doble],
  external: ["@supabase/*", "stripe", "ws"],
  logLevel: "error",
});

const sync = await import(pathToFileURL(path.join(AQUI, "sync.mjs")).href);
const { enviados } = await import(pathToFileURL(path.join(AQUI, "stub-quickbooks.js")).href);
const { hacerAdmin } = await import(pathToFileURL(path.join(AQUI, "admin.js")).href);
export { sync, enviados, hacerAdmin };
