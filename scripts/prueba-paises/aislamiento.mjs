/**
 * Lo de un país no se escribe ni se abre desde otro.
 *
 *   node --experimental-strip-types scripts/prueba-paises/aislamiento.mjs
 *
 * Son tres puertas y esta prueba vigila las dos que viven en el código:
 *
 * - `shared/soloDeUnPais.ts`, la regla con que el servidor rechaza un dato de
 *   Italia en un negocio de fuera (y un T4 fuera de Canadá).
 * - Las fichas de país de `shared/paises.ts`, que deciden qué familias de
 *   rutas abre la puerta de país de `server/api.ts` (nómina, CCQ, QuickBooks,
 *   lectores de tarjeta).
 *
 * La tercera son los triggers de la base (`private.exigir_*`), con las mismas
 * listas; se probaron contra la base real y están descritos en
 * docs/desarrollo/paises.md. Si cambias una lista aquí, cámbiala allí.
 */

import { CAMPOS_SOLO_ITALIA, PAPELES_SOLO_DE, camposDeItaliaFuera, papelDeOtroPais } from "../../shared/soloDeUnPais.ts";
import { tiposDePapelPara, TIPOS_DE_PAPEL } from "../../shared/papeles.ts";
import { paisDe, grupoDePais } from "../../shared/paises.ts";
import fs from "node:fs";

let bien = 0;
let mal = 0;
function ok(que, real, esperado) {
  const igual = JSON.stringify(real) === JSON.stringify(esperado);
  console.log(`${igual ? "ok " : "MAL"} ${que}${igual ? "" : ` — esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`}`);
  igual ? bien++ : mal++;
}

// Lo de Italia en una obra y en un cliente.
const obra = { bonusFiscale: "ristrutturazione", congruitaCategoria: "og2", lavoroPubblico: true, valoreOpera: 90000, name: "x" };
ok("Canadá: los cuatro campos de Italia de la obra, rechazados", camposDeItaliaFuera("CA", obra, CAMPOS_SOLO_ITALIA.obra), ["bonusFiscale", "congruitaCategoria", "lavoroPubblico", "valoreOpera"]);
ok("Otro país: igual", camposDeItaliaFuera("otros", obra, CAMPOS_SOLO_ITALIA.obra).length, 4);
ok("Italia: todo vale", camposDeItaliaFuera("IT", obra, CAMPOS_SOLO_ITALIA.obra), []);
ok(
  "Quitar vale siempre: null, vacío, false",
  camposDeItaliaFuera("CA", { bonusFiscale: null, congruitaCategoria: "", lavoroPubblico: false, valoreOpera: null }, CAMPOS_SOLO_ITALIA.obra),
  []
);
ok("Un PATCH que no toca lo de Italia pasa", camposDeItaliaFuera("CA", { progressPercent: 40 }, CAMPOS_SOLO_ITALIA.obra), []);
ok("Cliente de Canadá con código SDI: rechazado", camposDeItaliaFuera("CA", { codiceDestinatario: "M5UXCR1", name: "x" }, CAMPOS_SOLO_ITALIA.cliente), ["codiceDestinatario"]);
ok("Cliente de Canadá vaciando la Partita IVA: vale", camposDeItaliaFuera("CA", { partitaIva: "  " }, CAMPOS_SOLO_ITALIA.cliente), []);

// Los papeles: lo que se ofrece en cada país y lo que se acepta son lo mismo.
for (const grupo of ["CA", "IT", "otros"]) {
  const aceptados = TIPOS_DE_PAPEL.filter((t) => !papelDeOtroPais(grupo, t));
  ok(`${grupo}: se acepta justo lo que se ofrece`, aceptados.slice().sort(), tiposDePapelPara(grupo).slice().sort());
}
ok("Un DURC en Canadá es de otro país", papelDeOtroPais("CA", "durc"), true);
ok("Un T4 en Italia es de otro país", papelDeOtroPais("IT", "t4"), true);
ok("Un contrato vale en todas partes", ["CA", "IT", "otros"].map((g) => papelDeOtroPais(g, "contrato")), [false, false, false]);
ok("Ningún tipo es de dos países a la vez", PAPELES_SOLO_DE.IT.filter((t) => PAPELES_SOLO_DE.CA.includes(t)), []);

// La puerta de país del servidor lee estas fichas.
ok("Sin país guardado es Canadá", grupoDePais(null), "CA");
ok("Canadá: nómina, tarjeta y QuickBooks", ["nomina", "cobrosConTarjeta", "quickbooks"].map((f) => paisDe("CA")[f]), [true, true, true]);
ok("Italia: ni nómina de Quebec, ni lectores, ni QuickBooks", ["nomina", "cobrosConTarjeta", "quickbooks"].map((f) => paisDe("IT")[f]), [false, false, false]);
ok("España (sin configurar): tampoco", ["nomina", "cobrosConTarjeta", "quickbooks"].map((f) => paisDe("ES")[f]), [false, false, false]);
ok("El prezzario regionale, sólo en Italia", ["CA", "IT", "ES"].map((c) => paisDe(c).prezzario), [false, true, false]);

// Y que la puerta exista, con sus familias, después del inicio de sesión.
const api = fs.readFileSync(new URL("../../server/api.ts", import.meta.url), "utf8");
const puerta = api.indexOf("apiRouter.use(requireBusinessAuth);");
const reglas = api.indexOf("const RUTAS_DEL_PAIS");
ok("La puerta de país va detrás del inicio de sesión", puerta > 0 && reglas > puerta, true);
const familias = [...api.slice(reglas, api.indexOf("];", reglas)).matchAll(/prefijo: "([^"]+)", necesita: "([^"]+)"/g)].map((m) => `${m[1]}=${m[2]}`);
ok("Las familias cerradas por país", familias, ["/payroll=nomina", "/ccq=nomina", "/stripe/terminal=cobrosConTarjeta", "/quickbooks=quickbooks", "/prezzario=prezzario"]);

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
