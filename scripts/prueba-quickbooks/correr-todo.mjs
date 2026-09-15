/**
 * Toda la contabilidad que sale hacia QuickBooks, comprobada sin llamar a
 * Intuit.
 *
 *     node scripts/prueba-quickbooks/correr-todo.mjs
 *
 * Compila `server/quickbooksSync.ts` de verdad —el módulo que corre en
 * producción— y sustituye una sola pieza: la puerta de salida hacia Intuit,
 * que en vez de enviar graba lo que habría enviado. Así lo que se comprueba
 * es el documento exacto, con sus importes, tal y como lo recibiría
 * QuickBooks.
 *
 * Existe porque los fallos de una integración contable no se ven mirando la
 * pantalla: una factura que sale bien y un cobro que sale bien pueden dejar
 * el banco en negativo, y un asiento de nómina descuadrado lo rechaza
 * QuickBooks entero sin que nadie se entere hasta que el contable pregunta.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
let mal = 0;

for (const suite of ["obra.mjs", "esquinas.mjs"]) {
  const r = spawnSync(process.execPath, [path.join(AQUI, suite)], { encoding: "utf8" });
  process.stdout.write(r.stdout ?? "");
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0 || /\bXX\b/.test(r.stdout ?? "")) mal += 1;
}

process.exit(mal ? 1 : 0);
