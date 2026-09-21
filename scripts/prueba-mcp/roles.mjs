/**
 * Quién puede pedir qué por MCP.
 *
 *   node --experimental-strip-types scripts/prueba-mcp/roles.mjs
 *
 * Existe por dos fallos que costaron días y que no se ven leyendo el código:
 *
 * **El primero.** La autorización aceptaba a un dueño por dos reglas y la
 * resolución del token sólo por una. Quien entraba por la segunda pasaba el
 * consentimiento y luego recibía 401 en cada llamada; Claude lo lee como token
 * caducado y refresca en bucle. Desde fuera se ve como «el servidor no
 * responde», que es el síntoma que no lleva a la causa.
 *
 * **El segundo.** El rol de MCP se adivinaba del **nombre** del rol con
 * expresiones regulares, y el nombre lo escribe el contratista. «Administración
 * de obra» casaba con `admin` y esa persona recibía las herramientas de
 * administrador aunque en el panel sólo tuviera campo.
 *
 * Las dos cosas comparten causa: dos sitios decidiendo lo mismo con reglas
 * distintas. Lo que se comprueba aquí es que ya sólo hay una — la de las
 * áreas, que es la que abre y cierra pantallas en el panel.
 */

import { AREAS } from "../../shared/permisos.ts";
import { roleOf, TOOL_ACCESS, puedeUsarHerramienta } from "../../shared/mcpRoles.ts";

let bien = 0;
let mal = 0;
function ok(que, real, esperado) {
  const igual = JSON.stringify(real) === JSON.stringify(esperado);
  console.log(`${igual ? "ok " : "MAL"} ${que}${igual ? "" : ` — esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`}`);
  igual ? bien++ : mal++;
}

const dueno = (areas, workerRole = "admin") => ({ workerKind: "owner", areas, workerRole });
const empleado = (areas, workerRole = null) => ({ workerKind: "employee", areas, workerRole });
const subcontratista = (areas) => ({ workerKind: "subcontractor", areas, workerRole: null });

/* ---------- Lo que el nombre del rol ya no puede hacer ---------- */

ok("Un rol llamado «Administración de obra» pero con sólo campo NO es admin",
   roleOf(empleado(["campo"], "Administración de obra")), "manager");
ok("Un rol llamado «Responsable de obra» con campo SÍ es encargado",
   roleOf(empleado(["campo"], "Responsable de obra")), "manager");
ok("Un rol llamado «tecnico» con dinero y ajustes es admin: mandan las áreas",
   roleOf(empleado(["dinero", "ajustes"], "tecnico")), "admin");
ok("El nombre del rol no cambia nada por sí solo",
   roleOf(empleado(["campo"], "owner")), roleOf(empleado(["campo"], "cualquier cosa")));

/* ---------- El campo no sube solo ---------- */

ok("Un trabajador sin rol es trabajador, no «lo ve todo»",
   roleOf(empleado(null)), "worker");
ok("Un subcontratista sin rol, igual",
   roleOf(subcontratista(null)), "worker");
ok("Un trabajador con un papel de oficina asignado a propósito sí sube",
   roleOf(empleado(["dinero"])), "office");

/* ---------- El dueño ---------- */

ok("Quien lleva el negocio, sin límite, es admin",
   roleOf(dueno(null)), "admin");
ok("Un dueño al que le pusieron sólo campo no es admin",
   roleOf(dueno(["campo"])), "manager");
ok("Un dueño con todas las áreas es admin",
   roleOf(dueno([...AREAS])), "admin");
ok("Dinero sin ajustes es oficina, no administración",
   roleOf(dueno(["dinero"])), "office");

/* ---------- Lo que cada rol puede pedir ---------- */

const puedeUsar = puedeUsarHerramienta;

ok("Un jefe de obra NO ve la rentabilidad por obra",
   puedeUsar(empleado(["campo"]), "get_profitability"), false);
ok("Ni el resumen del negocio",
   puedeUsar(empleado(["campo"]), "get_business_summary"), false);
ok("Pero sí sus obras",
   puedeUsar(empleado(["campo"]), "get_projects"), true);
ok("Contabilidad ve las facturas",
   puedeUsar(empleado(["dinero"]), "get_invoices"), true);
ok("Y no la rentabilidad, que es sólo de quien lleva el negocio",
   puedeUsar(empleado(["dinero"]), "get_profitability"), false);
ok("Un trabajador de campo no ve ninguna factura",
   puedeUsar(empleado(null), "get_invoices"), false);
ok("Quien lleva el negocio sí ve la rentabilidad",
   puedeUsar(dueno(null), "get_profitability"), true);

/* ---------- Igual que el panel, no más ---------- */

/**
 * La regla permanente del plan maestro, comprobada: para cada combinación de
 * áreas, lo que MCP abre tiene que estar contenido en lo que el panel abre.
 */
const AREA_DE_HERRAMIENTA = Object.fromEntries(
  Object.entries(TOOL_ACCESS).map(([nombre, acceso]) => [nombre, acceso.area]),
);

let ampliaciones = [];
const combinaciones = [null, ["campo"], ["clientes"], ["dinero"], ["campo", "clientes"], ["dinero", "ajustes"], [...AREAS]];
for (const areas of combinaciones) {
  for (const [herramienta, area] of Object.entries(AREA_DE_HERRAMIENTA)) {
    const enElPanel = areas === null || areas.includes(area);
    for (const quien of [dueno(areas), empleado(areas)]) {
      if (puedeUsar(quien, herramienta) && !enElPanel) {
        ampliaciones.push(`${quien.workerKind} con ${JSON.stringify(areas)} → ${herramienta}`);
      }
    }
  }
}
ok("Ninguna combinación de áreas abre en MCP algo cerrado en el panel", ampliaciones, []);

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
