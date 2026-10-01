/**
 * Arranca la prueba del servidor MCP (ver `servidor/prueba.ts`).
 *
 *   node scripts/prueba-mcp/servidor.mjs
 *
 * Hay que empaquetarla porque el servidor importa sin extensión y node a
 * pelo no lo resuelve. Al empaquetar se cambia `supabaseAdmin` por la base de
 * datos de mentira; todo lo demás —el SDK, los permisos, el cálculo de la
 * factura— es el código que va a producción. El paquete se escribe dentro de
 * `node_modules/.cache` para que encuentre las dependencias.
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "../..");
const salida = path.join(raiz, "node_modules/.cache/prueba-mcp/servidor.mjs");
mkdirSync(path.dirname(salida), { recursive: true });

await build({
  entryPoints: [path.join(aqui, "servidor/prueba.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: salida,
  packages: "external",
  logLevel: "error",
  plugins: [
    {
      name: "base-de-mentira",
      setup(b) {
        b.onResolve({ filter: /\/supabaseAdmin$/ }, () => ({ path: path.join(aqui, "servidor/supabaseFalso.ts") }));
      },
    },
  ],
});

execFileSync(process.execPath, [salida], { stdio: "inherit", cwd: raiz });
