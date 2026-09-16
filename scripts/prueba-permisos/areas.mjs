/**
 * Quién ve qué, comprobado.
 *
 *     node scripts/prueba-permisos/areas.mjs
 *
 * Lo que se prueba es lo que un contratista da por hecho al crear un rol
 * «Jefe de obra»: que esa persona no vea lo que factura la empresa, ni lo que
 * gana, ni lo que cobra cada uno. Antes de esto, lo veía todo.
 */
import esbuild from "esbuild";
import { areasDelRol } from "./areasDelRol.mjs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../..");
await esbuild.build({
  entryPoints: [path.join(RAIZ, "shared/permisos.ts")],
  bundle: true, format: "esm", platform: "node",
  outfile: path.join(AQUI, "permisos.mjs"), logLevel: "error",
});
const p = await import(pathToFileURL(path.join(AQUI, "permisos.mjs")).href);

const out = [];
const di = (q, ok, d) => out.push(`${ok ? "ok " : "XX "} ${q}${d ? ` — ${d}` : ""}`);

const JEFE = p.PAPELES.jefe_de_obra;

// ---------- Lo que el jefe de obra sí ve ----------
for (const ruta of ["/projects", "/work-orders/abc", "/time-entries", "/employees", "/photos", "/time-off"]) {
  di(`El jefe de obra entra en ${ruta}`, p.puede(JEFE, p.areaDeLaRuta(ruta)), p.areaDeLaRuta(ruta));
}

// ---------- Lo que no ----------
for (const ruta of ["/invoices", "/reports", "/payroll", "/expenses", "/cost-tracking", "/quickbooks/status", "/estimates", "/settings/company", "/agreements", "/worker-documents/x"]) {
  const area = p.areaDeLaRuta(ruta);
  di(`El jefe de obra NO entra en ${ruta}`, !p.puede(JEFE, area), area);
}

// ---------- El dueño lo ve todo ----------
di("Sin rol asignado se ve todo", ["campo", "dinero", "ajustes", "personas", "clientes"].every((a) => p.puede(null, a)));

// ---------- Lo que se recorta de la respuesta ----------
const empleados = [
  { id: "1", name: "Jean", phone: "514", hourly_rate: 32.5, access_token: "SECRETO", assigned: [{ name: "Obra" }] },
];
const visto = p.recortar(empleados, JEFE);
di("No ve el sueldo de nadie", visto[0].hourly_rate === undefined, JSON.stringify(visto[0].hourly_rate));
di("Ni el código de acceso del trabajador", visto[0].access_token === undefined);
di("Pero sí el nombre y el teléfono", visto[0].name === "Jean" && visto[0].phone === "514");
di("Y lo anidado se limpia igual", Array.isArray(visto[0].assigned) && visto[0].assigned[0].name === "Obra");

const conDinero = p.recortar(empleados, ["campo", "dinero", "personas"]);
di("Quien sí puede, ve el sueldo", conDinero[0].hourly_rate === 32.5);
di("Al dueño no se le recorta nada", p.recortar(empleados, null)[0].access_token === "SECRETO");

// ---------- La pantalla de inicio ----------
di("El panel de inicio es dinero, no es del jefe de obra", !p.puede(JEFE, p.areaDeLaPantalla("/")));
di("Y se le lleva a una pantalla suya", p.puede(JEFE, p.areaDeLaPantalla(p.primeraPantalla(JEFE))), p.primeraPantalla(JEFE));
di("Al dueño se le deja en el inicio", p.primeraPantalla(null) === "/");
di("La ficha de una obra sigue siendo campo", p.areaDeLaPantalla("/projects/123") === "campo");
di("Y la de un cliente, clientes", p.areaDeLaPantalla("/crm/123") === "clientes");

// ---------- Una familia sin clasificar no se cuela ----------
di("Una ruta que nadie clasificó no tiene área", p.areaDeLaRuta("/algo-nuevo") === null);

// ---------- Los otros papeles ----------
di("Oficina ve clientes y campo, no dinero",
  p.puede(p.PAPELES.oficina, "clientes") && p.puede(p.PAPELES.oficina, "campo") && !p.puede(p.PAPELES.oficina, "dinero"));
di("Contabilidad ve dinero, no ajustes",
  p.puede(p.PAPELES.contabilidad, "dinero") && !p.puede(p.PAPELES.contabilidad, "ajustes"));

// ---------- Lo que ya había en la base ----------
// Esto es lo que de verdad hay hoy en `roles.permissions`: etiquetas escritas
// a mano y un `[]` por defecto. Leerlo como «no puede ver nada» habría echado
// del sistema a todos los usuarios que existen, empezando por los dueños.
di("Un rol admin con la lista vacía lo ve todo", areasDelRol({ permissions: [] }) === null);
di("Un rol con etiquetas viejas lo ve todo",
  areasDelRol({ permissions: ["Acceso total", "Facturación", "Configuración del negocio"] }) === null);
di("Un rol de técnico con etiquetas viejas también",
  areasDelRol({ permissions: ["Órdenes de trabajo asignadas", "Check-in/Check-out", "Fotos"] }) === null);
di("Sin rol, todo", areasDelRol(null) === null);
di("Pero con un área de verdad, manda la lista",
  JSON.stringify(areasDelRol({ permissions: ["campo"] })) === '["campo"]');
di("Y lo que no reconocemos se cae, sin abrir la puerta",
  JSON.stringify(areasDelRol({ permissions: ["campo", "Facturación"] })) === '["campo"]');

console.log(out.join("\n"));
const mal = out.filter((x) => x.startsWith("XX")).length;
console.log(`\n${out.length - mal} bien, ${mal} mal\n`);
process.exit(mal ? 1 : 0);
