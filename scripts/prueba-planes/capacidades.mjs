/**
 * Lo que cada plan deja y lo que no.
 *
 *     node --experimental-strip-types scripts/prueba-planes/capacidades.mjs
 *
 * Dos cosas que hay que fijar aquí y no descubrir con un contratista delante:
 *
 * 1. **Nadie se queda fuera de su propio sistema.** Los negocios que ya
 *    existían tienen `pilot` en la base, y hay valores que no vamos a
 *    reconocer nunca —un `null`, una palabra vieja—. Todos ésos lo abren todo.
 *    El error al revés es apagarle las nóminas a alguien un lunes.
 *
 * 2. **Lo que no está en el mapa pasa.** Al contrario que los permisos, donde
 *    lo que no se clasificó se niega. Allí el riesgo es enseñar de más; aquí
 *    es apagar una pantalla que alguien pagó.
 */
import { PLAN, PLANES, planDe, tiene, capacidadDeLaRuta, CAPACIDADES, PRECIO } from "../../shared/planes.ts";

const out = [];
const di = (q, ok, d) => out.push(`${ok ? "ok " : "XX "} ${q}${d ? ` — ${d}` : ""}`);

// ---------- Lo que se abre y lo que no ----------

di("Chantier no lleva nóminas", !tiene("chantier", "nomina"));
di("Chantier no lleva la CCQ", !tiene("chantier", "cumplimiento"));
di("Chantier no lleva contabilidad", !tiene("chantier", "contabilidad"));
di("Chantier sí lleva el campo y la facturación", tiene("chantier", "campo") && tiene("chantier", "facturacion"));

di(
  "Entreprise lo lleva todo",
  CAPACIDADES.every((c) => tiene("entreprise", c))
);
di(
  "La prueba lo lleva todo, sin recortes",
  CAPACIDADES.every((c) => tiene("prueba", c))
);
di(
  "Fondateur lo lleva todo",
  CAPACIDADES.every((c) => tiene("fondateur", c))
);

// ---------- Nadie se queda fuera ----------

di(
  "Los negocios de antes (pilot) lo ven todo",
  CAPACIDADES.every((c) => tiene("pilot", c))
);
for (const valor of [null, undefined, "", "gratis", "PRO", "entreprise "]) {
  const p = planDe(valor);
  di(`Un plan que no reconocemos (${JSON.stringify(valor)}) no cierra nada`, CAPACIDADES.every((c) => tiene(p, c)), p);
}
di("Y uno que sí reconocemos se respeta", planDe("chantier") === "chantier" && !tiene(planDe("chantier"), "nomina"));

// ---------- Las rutas ----------

const RUTAS = [
  ["/payroll", "nomina"],
  ["/payroll/2026-01/lines", "nomina"],
  ["/ccq/monthly", "cumplimiento"],
  ["/cost-tracking", "margen"],
  ["/quickbooks/status", "contabilidad"],
  ["/export/journal", "contabilidad"],
  ["/reports/aging", "reportes"],
];
for (const [ruta, esperada] of RUTAS) {
  di(`${ruta} pide «${esperada}»`, capacidadDeLaRuta(ruta) === esperada, capacidadDeLaRuta(ruta) ?? "ninguna");
}

// Lo que tiene todo el mundo no está en el mapa, y eso deja pasar.
for (const ruta of ["/projects", "/invoices", "/clients", "/work-orders", "/settings/company", "/loquesea"]) {
  const c = capacidadDeLaRuta(ruta);
  di(`${ruta} no pide nada y entra en los dos planes`, c === null || tiene("chantier", c));
}

// Lo que vive DENTRO de una pantalla que todos tienen no se puede cobrar
// aparte: dejaba un error a media ficha del técnico, que es de campo. Fue un
// fallo de verdad del primer mapa.
for (const ruta of ["/agreements", "/agreements/abc", "/worker-documents", "/worker-documents/abc?employee_id=1"]) {
  const c = capacidadDeLaRuta(ruta);
  di(`${ruta} vive en la ficha del técnico y entra en todos los planes`, c === null, c ?? "ninguna");
}

// El caso que importa de verdad: un Chantier pidiendo la nómina.
{
  const c = capacidadDeLaRuta("/payroll");
  di("Un Chantier pidiendo /payroll se queda fuera", c !== null && !tiene("chantier", c));
}

// ---------- Las personas de oficina ----------

di("Chantier tiene tope de 2 personas de oficina", PLAN.chantier.personasDeOficina === 2);
di("Entreprise no tiene tope", PLAN.entreprise.personasDeOficina === null);
di(
  "Ningún plan tiene tope de trabajadores de campo",
  Object.values(PLAN).every((d) => !("trabajadores" in d))
);

// ---------- Los precios ----------

di("Sólo los planes que se compran tienen precio", !PRECIO.fondateur && !PRECIO.pilot && !PRECIO.prueba);
di("Y los dos que se compran lo tienen", Boolean(PRECIO.chantier && PRECIO.entreprise));
di("Entreprise cuesta más que Chantier", PRECIO.entreprise.mes > PRECIO.chantier.mes);

// ---------- El mapa no miente ----------

di(
  "Todo plan está definido",
  PLANES.every((p) => Boolean(PLAN[p]))
);
di(
  "Ninguna definición inventa una capacidad",
  Object.values(PLAN).every((d) => d.capacidades.every((c) => CAPACIDADES.includes(c)))
);

console.log(out.join("\n"));
const mal = out.filter((x) => x.startsWith("XX")).length;
console.log(`\n${out.length - mal} bien, ${mal} mal\n`);
process.exit(mal ? 1 : 0);
