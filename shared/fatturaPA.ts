/**
 * La factura electrónica italiana: el XML FatturaPA (formato FPR12, entre
 * privados).
 *
 * En Italia un PDF no es una factura. La factura es este XML, que viaja por el
 * Sistema di Interscambio (SDI) de la Agenzia delle Entrate, y es el que mira
 * el commercialista. Hasta que lo enviemos nosotros (fase 5), el negocio lo
 * descarga y lo sube con su programa, su intermediario o el servicio gratuito
 * «Fatture e Corrispettivi»; lo que tiene que estar bien es el contenido.
 *
 * Función pura a propósito: recibe los datos y devuelve el texto. Así se
 * prueba y se valida contra el esquema oficial (XSD) sin base de datos ni red,
 * que es la única forma de saber que el SDI no la va a rechazar.
 *
 * Lo que no se cubre, a propósito: régimen forfettario, split payment con la
 * administración pública, clientes extranjeros, imposta di bollo. Ver
 * `docs/funciones/italia.md`.
 */

import type { DesgloseIva } from "./iva";

export interface DatosFiscalesCliente {
  partitaIva: string | null;
  codiceFiscale: string | null;
  codiceDestinatario: string | null;
  pec: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  region: string | null;
}

/** Lo que le falta a un cliente para poder recibir una factura electrónica. */
export type FaltaDelCliente = "identificativo" | "indirizzo" | "cap" | "comune";

export function faltaParaFatturaPA(c: DatosFiscalesCliente): FaltaDelCliente[] {
  const falta: FaltaDelCliente[] = [];
  // Una empresa se identifica por su Partita IVA; un particular, por su
  // codice fiscale. Uno de los dos, como mínimo: sin él el SDI no sabe a quién
  // va dirigida y la rechaza.
  if (!c.partitaIva?.trim() && !c.codiceFiscale?.trim()) falta.push("identificativo");
  if (!c.addressLine?.trim()) falta.push("indirizzo");
  if (!/^\d{5}$/.test(c.postalCode?.trim() ?? "")) falta.push("cap");
  if (!c.city?.trim()) falta.push("comune");
  return falta;
}

export interface DatosDelNegocio {
  nombre: string;
  partitaIva: string | null;
  codiceFiscale: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  province: string | null;
  /** RF01 es el régimen ordinario. Ver `regime_fiscale` en `businesses`. */
  regimeFiscale: string | null;
}

/** Lo que le falta al negocio para emitir. Se dice antes, no en el rechazo. */
export type FaltaDelNegocio = "partita_iva" | "indirizzo" | "cap" | "comune" | "provincia";

export function faltaDelNegocio(n: DatosDelNegocio): FaltaDelNegocio[] {
  const falta: FaltaDelNegocio[] = [];
  if (!/^\d{11}$/.test(n.partitaIva?.trim() ?? "")) falta.push("partita_iva");
  if (!n.addressLine?.trim()) falta.push("indirizzo");
  if (!/^\d{5}$/.test(n.postalCode?.trim() ?? "")) falta.push("cap");
  if (!n.city?.trim()) falta.push("comune");
  if (!/^[A-Z]{2}$/.test(n.province?.trim() ?? "")) falta.push("provincia");
  return falta;
}

export interface DocumentoFatturaPA {
  tipo: "fattura" | "acconto" | "nota_di_credito";
  numero: string;
  /** AAAA-MM-DD, la fecha de emisión en Italia. */
  data: string;
  /** Lo que se cobra antes de impuestos. */
  imponibile: number;
  desglose: DesgloseIva;
  descrizione: string;
  /** Lo que de verdad se paga: el total menos la ritenuta a garanzia, más lo que se libera. */
  importoPagamento: number;
  scadenza: string | null;
  ritenutaAGaranzia: number;
  ritenutaSvincolata: number;
  /** Más líneas de causal: la deducción a la que corresponde, si la hay. */
  causaliExtra?: string[];
  /** Sólo en una nota de crédito: la factura que corrige. */
  fatturaCollegata?: { numero: string; data: string } | null;
}

export interface EntradaFatturaPA {
  negocio: DatosDelNegocio;
  cliente: DatosFiscalesCliente & { nombre: string; country?: string | null };
  documento: DocumentoFatturaPA;
  /** Alfanumérico, único por quien transmite. Ver `progresivoDe`. */
  progressivo: string;
}

/**
 * El progresivo del envío, sacado del número del documento.
 *
 * El SDI exige que no se repita para quien transmite y que el nombre del
 * archivo lleve como mucho cinco caracteres. Sale del año y del correlativo
 * —«2026-0004» → 26·100000 + 4— escrito en base 36, que cabe en cinco hasta el
 * año 2099. Las notas de crédito suman 50 al año para no pisar nunca el de
 * una factura con el mismo correlativo.
 */
export function progresivoDe(numero: string, esNota: boolean): string {
  const m = /(\d{4})\D*(\d+)\s*$/.exec(numero);
  if (!m) throw new Error(`numero sin año y correlativo: ${numero}`);
  const anio = (Number(m[1]) % 100) + (esNota ? 50 : 0);
  return (anio * 100000 + (Number(m[2]) % 100000)).toString(36).toUpperCase().padStart(5, "0");
}

export function nombreDelArchivo(entrada: EntradaFatturaPA): string {
  return `IT${idTrasmittente(entrada.negocio)}_${entrada.progressivo}.xml`;
}

/** Quien transmite: el propio negocio, con su codice fiscale o su Partita IVA. */
function idTrasmittente(n: DatosDelNegocio): string {
  return (n.codiceFiscale?.trim() || n.partitaIva?.trim() || "").toUpperCase();
}

/**
 * Texto que el SDI acepta.
 *
 * Sólo caracteres latinos: un «€», unas comillas tipográficas o un emoji en
 * la descripción bastan para que rechace el archivo entero. Se cambian por su
 * equivalente o se quitan, y se escapa lo que el XML no deja escribir tal cual.
 */
function texto(valor: string, maximo: number): string {
  const limpio = valor
    .replace(/€/g, "EUR")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^ -~ -ÿ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximo);
  return limpio.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const importe = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

function el(nombre: string, contenido: string | null | undefined): string {
  return contenido === null || contenido === undefined || contenido === "" ? "" : `<${nombre}>${contenido}</${nombre}>`;
}

/** «Mario Rossi» → Nome «Mario», Cognome «Rossi». Un particular se nombra así en la factura. */
function nombreYApellido(nombre: string): { nome: string; cognome: string } | null {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length < 2) return null;
  return { nome: partes.slice(0, -1).join(" "), cognome: partes[partes.length - 1] };
}

const RIFERIMENTO_N63 = "Inversione contabile art. 17 c. 6 lett. a) DPR 633/72";

export function generarFatturaPA(entrada: EntradaFatturaPA): string {
  const { negocio, cliente, documento } = entrada;
  const pivaCliente = cliente.partitaIva?.replace(/\s+/g, "").replace(/^IT/i, "") || null;
  const cfCliente = cliente.codiceFiscale?.replace(/\s+/g, "").toUpperCase() || null;
  // Sin código propio, «0000000»: la factura llega por PEC si la hay, y si
  // no, al cassetto fiscale del cliente. Es lo correcto para un particular.
  const codiceDestinatario = cliente.codiceDestinatario?.trim().toUpperCase() || "0000000";
  const pecDestinatario = codiceDestinatario === "0000000" ? cliente.pec?.trim() || null : null;

  const aliquota = documento.desglose.ivaAliquota;
  const natura = documento.desglose.natura ?? null;
  const imposta = documento.desglose.iva;
  const totale = documento.imponibile + imposta;

  const anagraficaCliente = pivaCliente
    ? el("Denominazione", texto(cliente.nombre, 80))
    : (() => {
        const ny = nombreYApellido(cliente.nombre);
        return ny ? el("Nome", texto(ny.nome, 60)) + el("Cognome", texto(ny.cognome, 60)) : el("Denominazione", texto(cliente.nombre, 80));
      })();

  // La causal: la descripción y, si la hay, la retención, dicha. Cada
  // elemento admite 200 caracteres, así que una descripción larga va en
  // varios, que es lo que permite el formato.
  const causales: string[] = [];
  const descripcion = texto(documento.descrizione, 1000);
  for (let i = 0; i < descripcion.length; i += 200) causales.push(descripcion.slice(i, i + 200));
  if (documento.ritenutaAGaranzia > 0) causales.push(texto(`Ritenuta a garanzia trattenuta: ${importe(documento.ritenutaAGaranzia)} EUR`, 200));
  if (documento.ritenutaSvincolata > 0) causales.push(texto(`Svincolo ritenuta a garanzia: ${importe(documento.ritenutaSvincolata)} EUR`, 200));
  for (const extra of documento.causaliExtra ?? []) causales.push(texto(extra, 200));

  const tipoDocumento = documento.tipo === "nota_di_credito" ? "TD04" : documento.tipo === "acconto" ? "TD02" : "TD01";

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`,
    `<FatturaElettronicaHeader>`,
    `<DatiTrasmissione>`,
    `<IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${texto(idTrasmittente(negocio), 28)}</IdCodice></IdTrasmittente>`,
    `<ProgressivoInvio>${entrada.progressivo}</ProgressivoInvio>`,
    `<FormatoTrasmissione>FPR12</FormatoTrasmissione>`,
    `<CodiceDestinatario>${texto(codiceDestinatario, 7)}</CodiceDestinatario>`,
    el("PECDestinatario", pecDestinatario ? texto(pecDestinatario, 256) : null),
    `</DatiTrasmissione>`,
    `<CedentePrestatore>`,
    `<DatiAnagrafici>`,
    `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${texto(negocio.partitaIva ?? "", 28)}</IdCodice></IdFiscaleIVA>`,
    el("CodiceFiscale", negocio.codiceFiscale ? texto(negocio.codiceFiscale.toUpperCase(), 16) : null),
    `<Anagrafica><Denominazione>${texto(negocio.nombre, 80)}</Denominazione></Anagrafica>`,
    `<RegimeFiscale>${/^RF\d{2}$/.test(negocio.regimeFiscale ?? "") ? negocio.regimeFiscale : "RF01"}</RegimeFiscale>`,
    `</DatiAnagrafici>`,
    `<Sede>`,
    `<Indirizzo>${texto(negocio.addressLine ?? "", 60)}</Indirizzo>`,
    `<CAP>${texto(negocio.postalCode ?? "", 5)}</CAP>`,
    `<Comune>${texto(negocio.city ?? "", 60)}</Comune>`,
    el("Provincia", negocio.province ? texto(negocio.province, 2) : null),
    `<Nazione>IT</Nazione>`,
    `</Sede>`,
    `</CedentePrestatore>`,
    `<CessionarioCommittente>`,
    `<DatiAnagrafici>`,
    pivaCliente ? `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${texto(pivaCliente, 28)}</IdCodice></IdFiscaleIVA>` : "",
    el("CodiceFiscale", cfCliente ? texto(cfCliente, 16) : null),
    `<Anagrafica>${anagraficaCliente}</Anagrafica>`,
    `</DatiAnagrafici>`,
    `<Sede>`,
    `<Indirizzo>${texto(cliente.addressLine ?? "", 60)}</Indirizzo>`,
    `<CAP>${texto(cliente.postalCode ?? "", 5)}</CAP>`,
    `<Comune>${texto(cliente.city ?? "", 60)}</Comune>`,
    el("Provincia", cliente.region ? texto(cliente.region, 2) : null),
    `<Nazione>IT</Nazione>`,
    `</Sede>`,
    `</CessionarioCommittente>`,
    `</FatturaElettronicaHeader>`,
    `<FatturaElettronicaBody>`,
    `<DatiGenerali>`,
    `<DatiGeneraliDocumento>`,
    `<TipoDocumento>${tipoDocumento}</TipoDocumento>`,
    `<Divisa>EUR</Divisa>`,
    `<Data>${documento.data}</Data>`,
    `<Numero>${texto(documento.numero, 20)}</Numero>`,
    `<ImportoTotaleDocumento>${importe(totale)}</ImportoTotaleDocumento>`,
    ...causales.map((c) => `<Causale>${c}</Causale>`),
    `</DatiGeneraliDocumento>`,
    documento.fatturaCollegata
      ? `<DatiFattureCollegate><IdDocumento>${texto(documento.fatturaCollegata.numero, 20)}</IdDocumento><Data>${documento.fatturaCollegata.data}</Data></DatiFattureCollegate>`
      : "",
    `</DatiGenerali>`,
    `<DatiBeniServizi>`,
    `<DettaglioLinee>`,
    `<NumeroLinea>1</NumeroLinea>`,
    `<Descrizione>${descripcion || texto(documento.numero, 1000)}</Descrizione>`,
    `<PrezzoUnitario>${importe(documento.imponibile)}</PrezzoUnitario>`,
    `<PrezzoTotale>${importe(documento.imponibile)}</PrezzoTotale>`,
    `<AliquotaIVA>${importe(aliquota)}</AliquotaIVA>`,
    el("Natura", natura),
    `</DettaglioLinee>`,
    `<DatiRiepilogo>`,
    `<AliquotaIVA>${importe(aliquota)}</AliquotaIVA>`,
    el("Natura", natura),
    `<ImponibileImporto>${importe(documento.imponibile)}</ImponibileImporto>`,
    `<Imposta>${importe(imposta)}</Imposta>`,
    // Inmediata con IVA; con inversione contabile no se pone: el IVA lo
    // ingresa el cliente y no hay exigibilidad que declarar aquí.
    natura ? "" : `<EsigibilitaIVA>I</EsigibilitaIVA>`,
    natura === "N6.3" ? `<RiferimentoNormativo>${texto(RIFERIMENTO_N63, 100)}</RiferimentoNormativo>` : "",
    `</DatiRiepilogo>`,
    `</DatiBeniServizi>`,
    // Una nota de crédito no se cobra: no lleva datos de pago.
    documento.tipo === "nota_di_credito"
      ? ""
      : [
          `<DatiPagamento>`,
          `<CondizioniPagamento>TP02</CondizioniPagamento>`,
          `<DettaglioPagamento>`,
          `<ModalitaPagamento>MP05</ModalitaPagamento>`,
          el("DataScadenzaPagamento", documento.scadenza),
          `<ImportoPagamento>${importe(documento.importoPagamento)}</ImportoPagamento>`,
          `</DettaglioPagamento>`,
          `</DatiPagamento>`,
        ].join(""),
    `</FatturaElettronicaBody>`,
    `</p:FatturaElettronica>`,
  ];
  return xml.filter(Boolean).join("\n") + "\n";
}
