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
 * - Lo que depende del país —pagar con tarjeta, QuickBooks, qué ayuda se
 *   lee— sale de su ficha y no de suponer Canadá.
 * - Italia no se le ofrece a nadie mientras esté en pruebas, pero quien ya la
 *   tiene puesta la sigue viendo: si no, su propia ficha le cambiaría de país
 *   al guardar.
 */

import { calcularIva, esOpcionIva } from "../../shared/iva.ts";
import { causaleBonifico, ritenutaBancaria } from "../../shared/bonusEdilizi.ts";
import { esPartitaIvaValida, esCodiceFiscaleValido, esCodiceDestinatarioValido } from "../../shared/fiscaleItalia.ts";
import { paisDe, paisesQueSeOfrecen, esRegionDe, aplicaLaCcq, detectarPais, esPaisDelRegistro, avisoDelPais, grupoDePais, stripeOperaEn } from "../../shared/paises.ts";

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
ok("Italia se ofrece ya a cualquiera, también desde Quebec", paisesQueSeOfrecen("CA").map((p) => p.codigo), ["CA", "IT"]);
ok("quien ya es italiano la sigue viendo", paisesQueSeOfrecen("IT").map((p) => p.codigo), ["CA", "IT"]);
ok("107 provincias italianas", paisDe("IT").regiones.length, 107);
ok("«PE» es de los dos países y cada uno lo reconoce", [esRegionDe("IT", "PE"), esRegionDe("CA", "PE")], [true, true]);
ok("en Italia no hay nómina", paisDe("IT").nomina, false);
ok("ni CCQ, aunque la provincia se llame como una de Quebec", aplicaLaCcq("IT", "QC"), false);
ok("Italia factura en euros", paisDe("IT").moneda, "EUR");

// El registro: se adivina el país por la zona horaria, antes que por el idioma.
ok("zona de Roma con el móvil en español: Italia", detectarPais("Europe/Rome", ["es-ES"]), "IT");
ok("zona de Toronto con el móvil en italiano: Canadá", detectarPais("America/Toronto", ["it-IT"]), "CA");
ok("zona de Montreal: Canadá", detectarPais("America/Montreal", []), "CA");
ok("zona desconocida, idioma es-MX: México", detectarPais("Asia/Tokyo", ["es-MX"]), "MX");
ok("sin pistas: nada, y el formulario pone Canadá", detectarPais("Asia/Tokyo", ["ja-JP"]), null);

// Un país que no sabemos hacer: entra, con su moneda, sin impuesto prestado.
ok("España: euros y sin configurar", [paisDe("ES").moneda, paisDe("ES").impuestos], ["EUR", "sin_configurar"]);
ok("España no hereda la TPS/TVQ de Canadá", paisDe("ES").identificadoresFiscales.length, 0);
ok("sin país guardado sigue siendo Canadá", paisDe(null).codigo, "CA");
ok("un código inventado no se registra", esPaisDelRegistro("ZZ"), false);
ok("el aviso del panel por país: Italia ya no está en pruebas", [avisoDelPais("CA"), avisoDelPais("IT"), avisoDelPais("ES")], [null, null, "sin_configurar"]);
ok("quien es de España ve su país en la ficha", paisesQueSeOfrecen("ES").map((p) => p.codigo), ["CA", "IT", "ES"]);

// Lo que cada país puede usar. Un botón de pagar o una conexión a QuickBooks
// donde no funcionan es un botón que lleva a un error.
ok("tarjeta: sólo Canadá", ["CA", "IT", "ES"].map((c) => paisDe(c).cobrosConTarjeta), [true, false, false]);
ok("QuickBooks: sólo Canadá", ["CA", "IT", "ES"].map((c) => paisDe(c).quickbooks), [true, false, false]);
ok("Stripe opera en Italia y España, no en Colombia ni Venezuela", ["IT", "ES", "CO", "VE"].map(stripeOperaEn), [true, true, false, false]);
ok("la ayuda de cada uno", [grupoDePais("CA"), grupoDePais("IT"), grupoDePais("ES"), grupoDePais(null)], ["CA", "IT", "otros", "CA"]);

// El bonifico parlante: sin él, el cliente pierde la deducción.
ok("la retención del banco: 11 % del importe con el IVA quitado al 22 %", ritenutaBancaria(13750), 1239.75);
ok("el texto entero, con la ley, la factura, el C.F. y la P.IVA",
   causaleBonifico({ bonus: "ristrutturazione", numeroFattura: "2026-0004", dataFattura: "2026-09-10", codiceFiscaleBeneficiario: "rssmra80a01h501u", partitaIvaImpresa: "06363391001" }),
   "Pagamento fattura n. 2026-0004 del 10/09/2026 - per detrazione fiscale ai sensi dell'art. 16-bis D.P.R. 917/1986 - C.F. beneficiario RSSMRA80A01H501U - P.IVA 06363391001");
ok("ecobonus cita su propia ley", /L\. 296\/2006/.test(causaleBonifico({ bonus: "ecobonus", numeroFattura: "1", dataFattura: "2026-01-01", codiceFiscaleBeneficiario: "X", partitaIvaImpresa: "1" }) ?? ""), true);
ok("sin el codice fiscale del cliente no hay texto", causaleBonifico({ bonus: "ristrutturazione", numeroFattura: "1", dataFattura: "2026-01-01", codiceFiscaleBeneficiario: null, partitaIvaImpresa: "1" }), null);

console.log(`\n${bien} bien, ${mal} mal`);
if (mal > 0) process.exit(1);
