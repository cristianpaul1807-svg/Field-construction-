/**
 * Las deducciones fiscales de una obra en Italia (bonus edilizi) y el
 * «bonifico parlante» que las hace válidas.
 *
 * El cliente que reforma su casa deduce el 50 % (vivienda principal) o el 36 %
 * de lo que paga, pero **sólo si paga con un bonifico parlante**: una
 * transferencia que cita la ley de la deducción, el número y la fecha de la
 * factura, su codice fiscale y la Partita IVA de la impresa. Si falta algo, la
 * deducción se pierde, y la culpa la busca en quien le mandó la factura.
 *
 * Nadie se lo prepara. Aquí se escribe el texto entero para que lo copie, y se
 * calcula lo que el banco va a retener a la impresa: el 11 % del importe sin
 * IVA, con el IVA quitado siempre al 22 % porque el banco no sabe el tipo de
 * la factura. Esa retención no es un impago: es un crédito de la impresa ante
 * Hacienda.
 */

export const BONUS_FISCALI = ["ristrutturazione", "ecobonus", "sismabonus", "barriere"] as const;
export type BonusFiscale = (typeof BONUS_FISCALI)[number];

export function esBonusFiscale(v: unknown): v is BonusFiscale {
  return typeof v === "string" && (BONUS_FISCALI as readonly string[]).includes(v);
}

/** La ley que el bonifico tiene que citar, tal como la piden los bancos. */
export const RIFERIMENTO_NORMATIVO: Record<BonusFiscale, string> = {
  ristrutturazione: "art. 16-bis D.P.R. 917/1986",
  sismabonus: "art. 16-bis D.P.R. 917/1986",
  ecobonus: "art. 1, commi 344-347, L. 296/2006",
  barriere: "art. 119-ter D.L. 34/2020",
};

/** La retención que hace el banco sobre un bonifico parlante. */
export const RITENUTA_BONIFICO = 0.11;

/** Lo que el banco le retiene a la impresa de ese pago, al céntimo. */
export function ritenutaBancaria(importe: number): number {
  return Math.round((importe / 1.22) * RITENUTA_BONIFICO * 100) / 100;
}

/** «2026-09-10» → «10/09/2026», como lo escribe un banco italiano. */
function fechaItaliana(fecha: string): string {
  const [a, m, d] = fecha.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/**
 * El texto entero del bonifico, en italiano: lo lee el banco, no la persona.
 *
 * Sin el codice fiscale de quien deduce no se puede escribir, y se devuelve
 * `null` para que la pantalla pida el dato en vez de dar un texto que haría
 * perder la deducción.
 */
export function causaleBonifico(entrada: {
  bonus: BonusFiscale;
  numeroFattura: string;
  dataFattura: string;
  codiceFiscaleBeneficiario: string | null;
  partitaIvaImpresa: string | null;
}): string | null {
  const cf = entrada.codiceFiscaleBeneficiario?.replace(/\s+/g, "").toUpperCase();
  const piva = entrada.partitaIvaImpresa?.replace(/\s+/g, "");
  if (!cf || !piva) return null;
  return [
    `Pagamento fattura n. ${entrada.numeroFattura} del ${fechaItaliana(entrada.dataFattura)}`,
    `per detrazione fiscale ai sensi dell'${RIFERIMENTO_NORMATIVO[entrada.bonus]}`,
    `C.F. beneficiario ${cf}`,
    `P.IVA ${piva}`,
  ].join(" - ");
}
