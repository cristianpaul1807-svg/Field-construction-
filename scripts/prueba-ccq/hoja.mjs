/**
 * La hoja mensual de la CCQ, comprobada.
 *
 *     node scripts/prueba-ccq/hoja.mjs
 *
 * Lo que se prueba es lo que cuesta una multa: que las semanas se corten donde
 * las corta la CCQ —de domingo a sábado—, que las horas extra vayan a su
 * casilla y no sumadas a las normales, y que una persona sin oficio declarado
 * salga señalada en vez de salir en blanco.
 */
import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../..");
await esbuild.build({
  entryPoints: [path.join(RAIZ, "server/ccq.ts")],
  bundle: true, format: "esm", platform: "node",
  outfile: path.join(AQUI, "ccq.mjs"), logLevel: "error",
});
const ccq = await import(pathToFileURL(path.join(AQUI, "ccq.mjs")).href);

const out = [];
const di = (q, ok, d) => out.push(`${ok ? "ok " : "XX "} ${q}${d ? ` — ${d}` : ""}`);

// 2026-09-16 es miércoles; su semana empieza el domingo 13.
di("La semana empieza en domingo", ccq.domingoDeLaSemana(new Date("2026-09-16T12:00:00Z")) === "2026-09-13",
  ccq.domingoDeLaSemana(new Date("2026-09-16T12:00:00Z")));
// El sábado 19 sigue siendo la misma semana; el domingo 20 ya es la siguiente.
di("El sábado cierra la semana", ccq.domingoDeLaSemana(new Date("2026-09-19T23:00:00Z")) === "2026-09-13");
di("El domingo abre la siguiente", ccq.domingoDeLaSemana(new Date("2026-09-20T01:00:00Z")) === "2026-09-20");

di("Ocho horas son ocho", ccq.horasDe("2026-09-16T08:00:00Z", "2026-09-16T16:00:00Z") === 8);
di("Y siete y media, 7,5", ccq.horasDe("2026-09-16T08:00:00Z", "2026-09-16T15:30:00Z") === 7.5);
di("Un fichaje sin salida no cuenta", ccq.horasDe("2026-09-16T08:00:00Z", null) === 0);
di("Una salida antes de la entrada tampoco", ccq.horasDe("2026-09-16T16:00:00Z", "2026-09-16T08:00:00Z") === 0);

const r = ccq.rangoDelMes("2026-09");
di("El mes va del día 1 al 1 del siguiente", r.desde === "2026-09-01" && r.hasta === "2026-10-01", `${r?.desde} → ${r?.hasta}`);
di("Un mes inventado se rechaza", ccq.rangoDelMes("2026-13") === null);

const datos = new Map([
  ["Jean Tremblay", { ccq_trade: "charpentier-menuisier", ccq_status: "compagnon", ccq_sector: "residentiel", ccq_region: "montreal" }],
  ["Luc Gagnon", { ccq_trade: null, ccq_status: "apprenti_2", ccq_sector: "residentiel", ccq_region: null }],
]);
const lineas = ccq.armarLineas([
  // Jean: lunes y martes de la semana del 13, y un día de la del 20.
  { quien: "Jean Tremblay", entrada: "2026-09-14T08:00:00Z", salida: "2026-09-14T16:00:00Z", extra: false },
  { quien: "Jean Tremblay", entrada: "2026-09-15T08:00:00Z", salida: "2026-09-15T16:00:00Z", extra: false },
  { quien: "Jean Tremblay", entrada: "2026-09-15T16:00:00Z", salida: "2026-09-15T18:00:00Z", extra: true },
  { quien: "Jean Tremblay", entrada: "2026-09-21T08:00:00Z", salida: "2026-09-21T12:00:00Z", extra: false },
  { quien: "Luc Gagnon", entrada: "2026-09-14T08:00:00Z", salida: "2026-09-14T16:00:00Z", extra: false },
], datos);

di("Una línea por persona y semana", lineas.length === 3, `${lineas.length}`);
const jean1 = lineas.find((l) => l.trabajador === "Jean Tremblay" && l.semana === "2026-09-13");
di("Las horas de la semana se suman", jean1?.horas === 16, `${jean1?.horas} h`);
di("Las extra van a su casilla, no sumadas", jean1?.horasExtra === 2, `${jean1?.horasExtra} h`);
di("La semana siguiente va aparte",
  lineas.some((l) => l.trabajador === "Jean Tremblay" && l.semana === "2026-09-20" && l.horas === 4));
di("Quien está completo no tiene nada que falte", jean1?.falta.length === 0, (jean1?.falta ?? []).join(", "));
const luc = lineas.find((l) => l.trabajador === "Luc Gagnon");
di("A quien le falta el oficio y la región, se dice cuál",
  luc?.falta.length === 2 && luc.falta.includes("ccq_trade") && luc.falta.includes("ccq_region"),
  (luc?.falta ?? []).join(", "));
di("Ordenadas por persona y semana",
  lineas[0].trabajador === "Jean Tremblay" && lineas[0].semana === "2026-09-13" && lineas[2].trabajador === "Luc Gagnon");

console.log(out.join("\n"));
const mal = out.filter((x) => x.startsWith("XX")).length;
console.log(`\n${out.length - mal} bien, ${mal} mal\n`);
process.exit(mal ? 1 : 0);
