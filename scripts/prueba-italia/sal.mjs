/**
 * El SAL: certificar lo ejecutado partida a partida.
 *
 *   node --experimental-strip-types scripts/prueba-italia/sal.mjs
 *
 * Lo que se fija es lo que cobra de más o de menos sin que nadie lo vea:
 *
 * - El precio de cada partida es el del contrato: el coste con las mermas y el
 *   margen encima, igual que en el PDF del presupuesto.
 * - Un SAL factura sólo la diferencia con el anterior, y lo acumulado no baja.
 * - El anticipo se recupera en proporción, y el último SAL se lleva el resto
 *   al céntimo: tres SAL de un tercio no pueden dejar un céntimo sin recuperar.
 */

import { calcolaSal, righeDelContratto } from "../../shared/sal.ts";

let bien = 0;
let mal = 0;
function ok(que, real, esperado) {
  const igual = JSON.stringify(real) === JSON.stringify(esperado);
  console.log(`${igual ? "ok " : "MAL"} ${que}${igual ? "" : ` — esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`}`);
  igual ? bien++ : mal++;
}

// 8.000 de coste en dos partidas, 5 % de mermas y 20 % de margen: el
// contrato vale 8.000 × 1,05 × 1,2 = 10.080, más un extra aprobado de 920.
const righe = righeDelContratto(
  [
    { id: "a", zone: "Bagno", item_name: "Demolizioni", quantity: 1, total: 2000 },
    { id: "b", zone: "Bagno", item_name: "Piastrelle", quantity: 30, total: 6000 },
    { id: "c", zone: null, item_name: "Partida vacía", quantity: 0, total: 0 },
  ],
  5,
  20,
  [{ id: "x", title: "Doccia in muratura", amount: 920 }]
);
ok("Las partidas a precio de contrato, sin las vacías", righe.map((r) => [r.chiave, r.importo, r.prezzoUnitario]), [["l:a", 2520, 2520], ["l:b", 7560, 252], ["v:x", 920, 920]]);

const base = { righe, avanzamentoPrecedente: {}, cumulatoPrecedente: 0, acconti: 3300, accontoGiaRecuperato: 0 };

// SAL 1: demoliciones enteras y un tercio del alicatado.
const s1 = calcolaSal({ ...base, avanzamento: { "l:a": 100, "l:b": 33.33 } });
ok("SAL 1: contrato, acumulado e importe", [s1.contratto, s1.cumulato, s1.importo], [11000, 5039.75, 5039.75]);
ok("SAL 1: recupera el anticipo en proporción (3.300 × 5.039,75 / 11.000)", [s1.recuperoAcconto, s1.daFatturare], [1511.93, 3527.82]);
ok("SAL 1: no es el final", s1.finale, false);

// SAL 2: el alicatado al 80 %. Las partidas que no se tocan se quedan.
const prev2 = Object.fromEntries(s1.righe.map((r) => [r.chiave, r.percentuale]));
const s2 = calcolaSal({ ...base, avanzamentoPrecedente: prev2, cumulatoPrecedente: s1.cumulato, accontoGiaRecuperato: s1.recuperoAcconto, avanzamento: { "l:b": 80 } });
ok("SAL 2: sólo factura la diferencia", [s2.cumulato, s2.precedente, s2.importo], [8568, 5039.75, 3528.25]);
ok("SAL 2: la partida que no se tocó sigue al 100 %", s2.righe.find((r) => r.chiave === "l:a").percentuale, 100);

// SAL 3: todo terminado. Se lleva el resto exacto del anticipo.
const prev3 = Object.fromEntries(s2.righe.map((r) => [r.chiave, r.percentuale]));
const recuperado = Math.round((s1.recuperoAcconto + s2.recuperoAcconto) * 100) / 100;
const s3 = calcolaSal({ ...base, avanzamentoPrecedente: prev3, cumulatoPrecedente: s2.cumulato, accontoGiaRecuperato: recuperado, avanzamento: { "l:b": 100, "v:x": 100 } });
ok("SAL 3: es el final", s3.finale, true);
ok("SAL 3: el acumulado es el contrato", s3.cumulato, 11000);
ok("Los tres SAL recuperan el anticipo entero, al céntimo", Math.round((s1.recuperoAcconto + s2.recuperoAcconto + s3.recuperoAcconto) * 100) / 100, 3300);
ok("Los tres SAL certifican el contrato entero", Math.round((s1.importo + s2.importo + s3.importo) * 100) / 100, 11000);

// Lo que no se puede.
const atras = calcolaSal({ ...base, avanzamentoPrecedente: { "l:b": 50 }, cumulatoPrecedente: 3780, avanzamento: { "l:b": 40 } });
ok("Bajar una partida es un error, no un SAL negativo", [atras.errori.retrocede, atras.importo], [["l:b"], 0]);
const fuera = calcolaSal({ ...base, avanzamento: { "l:a": 120, "l:b": -5, "v:x": Number.NaN } });
ok("Por encima de 100, negativo o no numérico: fuera de rango", fuera.errori.fuoriRango, ["l:a", "l:b", "v:x"]);
const sinAnticipo = calcolaSal({ ...base, acconti: 0, avanzamento: { "l:a": 50 } });
ok("Sin anticipo no se descuenta nada", [sinAnticipo.recuperoAcconto, sinAnticipo.daFatturare], [0, 1260]);

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
