/**
 * La congruità de la mano de obra (DM 143/2021).
 *
 *   node --experimental-strip-types scripts/prueba-italia/congruita.mjs
 *
 * Lo que se fija aquí es lo que, si cambia sin querer, nadie lo nota hasta
 * que la Cassa Edile le niega a alguien el DURC de congruità:
 *
 * - Los índices son los de la tabla oficial, copiados uno a uno. Un 26 % donde
 *   la tabla dice 22 % hace parecer no congrua una reforma que lo es.
 * - El umbral de 70.000 € es para obras privadas; las públicas, siempre.
 * - El 5 % de tolerancia es sobre el mínimo, no sobre el valor de la obra.
 */

import { calcolaCongruita, INDICI_CONGRUITA, CATEGORIE_CONGRUITA, SOGLIA_PRIVATI } from "../../shared/congruita.ts";

let bien = 0;
let mal = 0;
function ok(que, real, esperado) {
  const igual = JSON.stringify(real) === JSON.stringify(esperado);
  console.log(`${igual ? "ok " : "MAL"} ${que}${igual ? "" : ` — esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`}`);
  igual ? bien++ : mal++;
}

// La tabla del Accordo del 10/09/2020 (OG) y la del 24/06/2022 (OS), tal
// como las publica la CNCE.
const OFICIAL = {
  og1_civile: 14.28, og1_industriale: 5.36, ristrutturazione_civile: 22, ristrutturazione_industriale: 6.69,
  og2: 30, og3: 13.77, og3_bitumatura: 6, og4: 10.82, og5: 16.07, og6_acquedotti: 14.63, og6_gasdotti: 13.66,
  og6_oleodotti: 13.66, og6_irrigazione: 12.48, og7: 12.16, og8: 13.31, og9: 14.23, og10: 5.36, og12_og13: 16.47,
  os1: 10, os2a: 35, os6: 14, os7: 18, os8: 18, os11: 12.5, os12a: 10, os12b: 13, os13: 6, os21: 15, os23: 10,
  os24: 20, os25: 30, os26: 7, os35: 15,
};
ok("Las 33 categorías, ni una más ni una menos", CATEGORIE_CONGRUITA.slice().sort(), Object.keys(OFICIAL).sort());
ok(
  "Cada índice es el de la tabla oficial",
  Object.entries(OFICIAL).filter(([c, pct]) => Math.round(INDICI_CONGRUITA[c] * 10000) !== Math.round(pct * 100)).map(([c]) => c),
  []
);

const reforma = (manodopera, extra = {}) =>
  calcolaCongruita({ categoria: "ristrutturazione_civile", valoreOpera: 100000, lavoroPubblico: false, manodopera, ...extra });

ok("22.000 € sobre 100.000 € de reforma: congrua", [reforma(22000).estado, reforma(22000).falta], ["congrua", 0]);
ok("Un 5 % por debajo del mínimo todavía certifica", [reforma(20900).estado, reforma(20900).falta], ["tolleranza", 1100]);
ok("Un céntimo más abajo, ya no", reforma(20899.99).estado, "non_congrua");
ok("El mínimo se redondea al céntimo", calcolaCongruita({ categoria: "og1_civile", valoreOpera: 77777.77, lavoroPubblico: false, manodopera: 0 }).minima, 11106.67);

ok("Privada por debajo de 70.000 €: no se pide", reforma(0, { valoreOpera: SOGLIA_PRIVATI - 0.01 }).estado, "no_aplica");
ok("Privada de 70.000 € justos: se pide", reforma(0, { valoreOpera: SOGLIA_PRIVATI }).estado, "non_congrua");
ok("Pública, aunque sea pequeña: se pide", reforma(0, { valoreOpera: 20000, lavoroPubblico: true }).estado, "non_congrua");
ok("Privada pequeña sin categoría: no se le pide elegirla", reforma(0, { valoreOpera: 30000, categoria: null }).estado, "no_aplica");
ok("Sin categoría no hay mínimo", reforma(5000, { categoria: null }).estado, "sin_categoria");
ok("Una categoría inventada cuenta como ninguna", reforma(5000, { categoria: "og99" }).estado, "sin_categoria");
ok("Pública sin valor: falta el valor", reforma(0, { valoreOpera: 0, lavoroPubblico: true }).estado, "sin_valor");

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
