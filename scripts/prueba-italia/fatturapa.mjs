/**
 * La factura electrónica italiana, generada y validada contra el esquema
 * oficial de la Agenzia delle Entrate.
 *
 *   node --experimental-strip-types scripts/prueba-italia/fatturapa.mjs
 *
 * Un XML que no cumple el esquema el SDI lo rechaza entero, días después, y
 * la factura «emitida» no existe para nadie. Aquí se generan los casos que de
 * verdad pasan —acconto con ritenuta a garanzia a una empresa, saldo a un
 * particular, subcontrato en inversione contabile, nota de crédito— y cada uno
 * se pasa por `xmllint` contra el XSD 1.2.2, que vive junto a esta prueba.
 * Si no hay `xmllint` se comprueba sólo el contenido, y se dice.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generarFatturaPA, progresivoDe, nombreDelArchivo, faltaParaFatturaPA, faltaDelNegocio } from "../../shared/fatturaPA.ts";
import { calcularIva } from "../../shared/iva.ts";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const XSD = path.join(aqui, "xsd/Schema_del_file_xml_FatturaPA_v1.2.2.xsd");

let bien = 0;
let mal = 0;
function ok(que, real, esperado) {
  const igual = JSON.stringify(real) === JSON.stringify(esperado);
  console.log(`${igual ? "ok " : "MAL"} ${que}${igual ? "" : ` — esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`}`);
  igual ? bien++ : mal++;
}

let hayXmllint = true;
try {
  execFileSync("xmllint", ["--version"], { stdio: "ignore" });
} catch {
  hayXmllint = false;
  console.log("(sin xmllint: se comprueba el contenido, no el esquema)");
}
const carpeta = mkdtempSync(path.join(tmpdir(), "fatturapa-"));
function valida(nombre, xml) {
  if (!hayXmllint) return true;
  const archivo = path.join(carpeta, nombre);
  writeFileSync(archivo, xml);
  try {
    execFileSync("xmllint", ["--noout", "--nonet", "--schema", XSD, archivo], { stdio: "pipe" });
    return true;
  } catch (e) {
    console.log(String(e.stderr ?? e).slice(0, 800));
    return false;
  }
}

const negocio = {
  nombre: "Edil Rossi S.r.l. — «costruzioni» & ristrutturazioni",
  partitaIva: "06363391001",
  codiceFiscale: "06363391001",
  addressLine: "Via Roma 12",
  postalCode: "00144",
  city: "Roma",
  province: "RM",
  regimeFiscale: "RF01",
};
const empresa = {
  nombre: "Bianchi Costruzioni S.p.A.",
  partitaIva: "IT 01234567897",
  codiceFiscale: null,
  codiceDestinatario: "m5uxcr1",
  pec: null,
  addressLine: "Corso Italia 4",
  postalCode: "20122",
  city: "Milano",
  region: "MI",
};
const particular = {
  nombre: "Mario De Luca",
  partitaIva: null,
  codiceFiscale: "rssmra80a01h501u",
  codiceDestinatario: null,
  pec: "mario@pec.it",
  addressLine: "Via Verdi 3",
  postalCode: "10121",
  city: "Torino",
  region: "TO",
};

// 1) Acconto del 30 % a una empresa, 10 % de IVA y ritenuta a garanzia del 5 %.
{
  const imponibile = 12500;
  const { breakdown } = calcularIva(imponibile, "10");
  const xml = generarFatturaPA({
    negocio,
    cliente: empresa,
    progressivo: progresivoDe("2026-0004", false),
    documento: {
      tipo: "acconto", numero: "2026-0004", data: "2026-09-10", imponibile, desglose: breakdown,
      descrizione: "Acconto 30% ristrutturazione bagno — Via Roma 12 “piano terra”",
      importoPagamento: imponibile + breakdown.iva - 625, scadenza: "2026-10-10", ritenutaAGaranzia: 625, ritenutaSvincolata: 0,
      causaliExtra: ["Lavori agevolati ai sensi dell'art. 16-bis D.P.R. 917/1986"],
    },
  });
  ok("acconto: cumple el esquema oficial", valida("acconto.xml", xml), true);
  ok("acconto: TD02, 10 %, total y lo que se paga", [
    /<TipoDocumento>TD02</.test(xml), /<AliquotaIVA>10.00</.test(xml),
    /<ImportoTotaleDocumento>13750.00</.test(xml), /<ImportoPagamento>13125.00</.test(xml),
  ], [true, true, true, true]);
  ok("acconto: la empresa por su Partita IVA, sin «IT» ni espacios, y su código SDI en mayúsculas", [
    /<CessionarioCommittente><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT<\/IdPaese><IdCodice>01234567897</.test(xml.replace(/\n/g, "")),
    /<CodiceDestinatario>M5UXCR1</.test(xml),
  ], [true, true]);
  ok("acconto: sin «€», comillas tipográficas ni rayas", /[€“”—«»]/.test(xml.replace(/«|»/g, "")), false);
  ok("acconto: la ritenuta, dicha en la causal", /Ritenuta a garanzia trattenuta: 625.00 EUR/.test(xml), true);
  ok("acconto: la deducción del cliente, en la causal (con el apóstrofo escapado)", /Lavori agevolati ai sensi dell&apos;art. 16-bis/.test(xml), true);
}

// 2) Saldo a un particular, 22 %, con su PEC y sin código SDI.
{
  const { breakdown } = calcularIva(8000, "22");
  const xml = generarFatturaPA({
    negocio, cliente: particular, progressivo: progresivoDe("2026-0005", false),
    documento: { tipo: "fattura", numero: "2026-0005", data: "2026-09-20", imponibile: 8000, desglose: breakdown, descrizione: "Saldo lavori", importoPagamento: 9760, scadenza: null, ritenutaAGaranzia: 0, ritenutaSvincolata: 0 },
  });
  ok("particular: cumple el esquema oficial", valida("particular.xml", xml), true);
  ok("particular: Nome y Cognome, codice fiscale en mayúsculas, 0000000 y su PEC", [
    /<Nome>Mario De<\/Nome><Cognome>Luca<\/Cognome>/.test(xml), /<CodiceFiscale>RSSMRA80A01H501U</.test(xml),
    /<CodiceDestinatario>0000000</.test(xml), /<PECDestinatario>mario@pec.it</.test(xml),
  ], [true, true, true, true]);
}

// 3) Subcontrato en inversione contabile: sin IVA, N6.3 y la norma citada.
{
  const { breakdown } = calcularIva(20000, "rc");
  const xml = generarFatturaPA({
    negocio, cliente: empresa, progressivo: progresivoDe("2026-0006", false),
    documento: { tipo: "fattura", numero: "2026-0006", data: "2026-09-25", imponibile: 20000, desglose: breakdown, descrizione: "Subappalto opere murarie", importoPagamento: 20000, scadenza: "2026-10-25", ritenutaAGaranzia: 0, ritenutaSvincolata: 0 },
  });
  ok("inversione contabile: cumple el esquema oficial", valida("rc.xml", xml), true);
  ok("inversione contabile: 0 %, N6.3, la norma y sin exigibilidad", [
    /<AliquotaIVA>0.00<\/AliquotaIVA>\n<Natura>N6.3</.test(xml), /RiferimentoNormativo>Inversione contabile art. 17/.test(xml), /EsigibilitaIVA/.test(xml),
  ], [true, true, false]);
}

// 4) Nota de crédito: TD04, sin datos de pago, con la factura que corrige.
{
  const { breakdown } = calcularIva(1000, "10");
  const xml = generarFatturaPA({
    negocio, cliente: empresa, progressivo: progresivoDe("2026-0001", true),
    documento: { tipo: "nota_di_credito", numero: "NC-2026-0001", data: "2026-09-28", imponibile: 1000, desglose: breakdown, descrizione: "Storno parziale", importoPagamento: 0, scadenza: null, ritenutaAGaranzia: 0, ritenutaSvincolata: 0, fatturaCollegata: { numero: "2026-0004", data: "2026-09-10" } },
  });
  ok("nota de crédito: cumple el esquema oficial", valida("nc.xml", xml), true);
  ok("nota de crédito: TD04, la factura corregida y sin pago", [/<TipoDocumento>TD04</.test(xml), /<IdDocumento>2026-0004</.test(xml), /DatiPagamento/.test(xml)], [true, true, false]);
}

// El nombre del archivo y el progresivo.
ok("progresivo: cinco caracteres, distinto para factura y nota con el mismo número", [progresivoDe("2026-0004", false).length, progresivoDe("2026-0004", false) !== progresivoDe("2026-0004", true)], [5, true]);
ok("nombre del archivo: IT + codice fiscale de quien transmite + progresivo", nombreDelArchivo({ negocio, cliente: empresa, documento: null, progressivo: "4MI3K" }), "IT06363391001_4MI3K.xml");

// Lo que falta, dicho antes de intentarlo.
ok("un cliente sin identificativo ni dirección", faltaParaFatturaPA({ ...particular, codiceFiscale: null, addressLine: "", postalCode: "123" }), ["identificativo", "indirizzo", "cap"]);
ok("un negocio sin Partita IVA ni provincia", faltaDelNegocio({ ...negocio, partitaIva: "", province: null }), ["partita_iva", "provincia"]);

console.log(`\n${bien} bien, ${mal} mal`);
if (mal > 0) process.exit(1);
