/**
 * El IVA italiano y lo que Italia pide antes de dejar emitir una factura.
 *
 *   node --experimental-strip-types scripts/prueba-italia/iva.mjs
 *
 * Tres cosas que no se ven fallar hasta que alguien tiene una factura mal:
 *
 * - El IVA se calcula sobre el importe entero y se redondea una vez, y la
 *   inversione contabile va a cero con su código N6.3 —sin él, la factura
 *   electrónica no dice por qué no lleva IVA y el SDI la rechaza—.
 * - La Partita IVA y el codice fiscale llevan un dígito de control. Aceptar
 *   uno mal tecleado es una factura rechazada días después.
 * - Italia no se le ofrece a nadie mientras esté en pruebas, pero quien ya la
 *   tiene puesta la sigue viendo: si no, su propia ficha le cambiaría de país
 *   al guardar.
 */

import { calcularIva, esOpcionIva } from "../../shared/iva.ts";
import { esPartitaIvaValida, esCodiceFiscaleValido, esCodiceDestinatarioValido } from "../../shared/fiscaleItalia.ts";
import { paisDe, paisesQueSeOfrecen, esRegionDe, aplicaLaCcq } from "../../shared/paises.ts";

let bien = 0;
let mal = 0;
function ok(que, real, esperado) {
  const igual = JSON.stringify(real) === JSON.stringify(esperado);
  console.log(`${igual ? "ok " : "MAL"} ${que}${igual ? "" : ` — esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`}`);
  igual ? bien++ : mal++;
}

// El impuesto.
ok("22 % sobre 12.500", calcularIva(12500, "22").taxAmount, 2750);
ok("10 % sobre 12.500", calcularIva(12500, "10").taxAmount, 1250);
ok("4 % sobre 999,99 al céntimo", calcularIva(999.99, "4").taxAmount, 40);
ok("inversione contabile: sin IVA y con N6.3", calcularIva(12500, "rc").breakdown, { country: "IT", ivaAliquota: 0, iva: 0, natura: "N6.3" });
ok("el desglose dice que es italiano", calcularIva(100, "22").breakdown.country, "IT");
ok("una opción inventada no vale", esOpcionIva("21"), false);

// Los identificadores.
ok("Partita IVA real (Agenzia delle Entrate)", esPartitaIvaValida("06363391001"), true);
ok("Partita IVA con el control cambiado", esPartitaIvaValida("06363391002"), false);
ok("Partita IVA con 10 cifras", esPartitaIvaValida("0636339100"), false);
ok("codice fiscale de persona", esCodiceFiscaleValido("RSSMRA80A01H501U"), true);
ok("codice fiscale con la letra de control mal", esCodiceFiscaleValido("RSSMRA80A01H501A"), false);
ok("codice fiscale de sociedad = su Partita IVA", esCodiceFiscaleValido("06363391001"), true);
ok("codice destinatario de 7", esCodiceDestinatarioValido("M5UXCR1"), true);

// El país.
ok("a un negocio de Quebec no se le ofrece Italia", paisesQueSeOfrecen("CA").map((p) => p.codigo), ["CA"]);
ok("quien ya es italiano la sigue viendo", paisesQueSeOfrecen("IT").map((p) => p.codigo), ["CA", "IT"]);
ok("107 provincias italianas", paisDe("IT").regiones.length, 107);
ok("«PE» es de los dos países y cada uno lo reconoce", [esRegionDe("IT", "PE"), esRegionDe("CA", "PE")], [true, true]);
ok("en Italia no hay nómina", paisDe("IT").nomina, false);
ok("ni CCQ, aunque la provincia se llame como una de Quebec", aplicaLaCcq("IT", "QC"), false);
ok("Italia factura en euros", paisDe("IT").moneda, "EUR");

console.log(`\n${bien} bien, ${mal} mal`);
if (mal > 0) process.exit(1);
