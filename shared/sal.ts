/**
 * El SAL —stato avanzamento lavori, la certificación de obra—: cobrar lo
 * ejecutado, línea a línea del contrato.
 *
 * En la obra mediana italiana no se cobra por hitos fijos (50/25/25) sino por
 * lo hecho: cada mes, o cada cierto avance, se mide qué parte de cada partida
 * del presupuesto está ejecutada, se valora a precio de contrato, y se factura
 * la diferencia con el SAL anterior. Hasta ahora eso se hacía en una hoja de
 * cálculo aparte, copiando las partidas a mano, y la factura salía de otra.
 *
 * Tres reglas que, mal hechas, cobran de más o de menos:
 *
 * - **Lo acumulado no retrocede.** Cada SAL dice cuánto está hecho *hasta
 *   hoy*; bajar una partida respecto al anterior es corregir algo ya
 *   facturado, y eso se hace con una nota de crédito, no aquí.
 * - **El precio es el del contrato**, con el margen y las mermas repartidos en
 *   cada partida como en el presupuesto que firmó el cliente.
 * - **El anticipo se recupera.** Si el cliente pagó un acconto, cada SAL
 *   descuenta su parte proporcional, y el último lo que quede. Sin eso, el
 *   anticipo se cobra dos veces.
 */

export interface RigaContratto {
  /** `l:<id>` para una partida del presupuesto, `v:<id>` para un extra aprobado. */
  chiave: string;
  descrizione: string;
  zona: string | null;
  quantita: number;
  prezzoUnitario: number;
  /** Lo que vale la partida entera a precio de contrato. */
  importo: number;
}

const alCentimo = (x: number) => Math.round(x * 100) / 100;

/**
 * Las partidas del contrato con su precio de venta.
 *
 * Las líneas del presupuesto guardan el coste; el precio que firmó el cliente
 * lleva encima las mermas y el margen, repartidos igual que en el PDF del
 * presupuesto (ver `buildEstimatePdf` en server/api.ts).
 */
export function righeDelContratto(
  lineas: { id: string; zone: string | null; item_name: string; quantity: number | string; total: number | string }[],
  mermaPorCiento: number,
  margenPorCiento: number,
  extras: { id: string; title: string; amount: number | string }[]
): RigaContratto[] {
  const subida = (1 + (mermaPorCiento || 0) / 100) * (1 + (margenPorCiento || 0) / 100);
  const partidas = lineas.map((l) => {
    const importo = alCentimo(Number(l.total) * subida);
    const quantita = Number(l.quantity) || 0;
    return {
      chiave: `l:${l.id}`,
      descrizione: l.item_name,
      zona: l.zone ?? null,
      quantita,
      prezzoUnitario: quantita ? alCentimo(importo / quantita) : importo,
      importo,
    };
  });
  const varianti = extras.map((e) => ({
    chiave: `v:${e.id}`,
    descrizione: e.title,
    zona: null,
    quantita: 1,
    prezzoUnitario: alCentimo(Number(e.amount)),
    importo: alCentimo(Number(e.amount)),
  }));
  return [...partidas, ...varianti].filter((r) => r.importo > 0);
}

export interface RigaSal extends RigaContratto {
  /** Lo ejecutado hasta hoy, de 0 a 100. */
  percentuale: number;
  percentualePrecedente: number;
  cumulato: number;
  precedente: number;
  questo: number;
}

export interface CalcoloSal {
  righe: RigaSal[];
  contratto: number;
  cumulato: number;
  /** Lo acumulado en el SAL anterior, tal como se guardó. */
  precedente: number;
  /** Lo que se certifica en este SAL: acumulado menos anterior. */
  importo: number;
  /** La parte del anticipo que descuenta este SAL. */
  recuperoAcconto: number;
  /** Lo que se factura: el SAL menos el anticipo que recupera. */
  daFatturare: number;
  /** Si con este SAL la obra queda certificada entera. */
  finale: boolean;
  errori: { fuoriRango: string[]; retrocede: string[] };
}

export function calcolaSal(entrada: {
  righe: RigaContratto[];
  avanzamento: Record<string, number>;
  avanzamentoPrecedente: Record<string, number>;
  /** El acumulado guardado del SAL anterior, 0 si es el primero. */
  cumulatoPrecedente: number;
  /** El anticipo facturado en la obra, sin impuestos. */
  acconti: number;
  /** Lo que ya recuperaron los SAL anteriores. */
  accontoGiaRecuperato: number;
}): CalcoloSal {
  const fuoriRango: string[] = [];
  const retrocede: string[] = [];
  const righe = entrada.righe.map((r) => {
    const prec = Number(entrada.avanzamentoPrecedente[r.chiave] ?? 0) || 0;
    const pedido = entrada.avanzamento[r.chiave];
    const pct = pedido === undefined || pedido === null ? prec : Number(pedido);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) fuoriRango.push(r.chiave);
    else if (pct < prec) retrocede.push(r.chiave);
    const valido = Number.isFinite(pct) ? Math.min(100, Math.max(prec, pct)) : prec;
    const cumulato = alCentimo((r.importo * valido) / 100);
    const precedente = alCentimo((r.importo * prec) / 100);
    return { ...r, percentuale: valido, percentualePrecedente: prec, cumulato, precedente, questo: alCentimo(cumulato - precedente) };
  });

  const contratto = alCentimo(righe.reduce((s, r) => s + r.importo, 0));
  const cumulato = alCentimo(righe.reduce((s, r) => s + r.cumulato, 0));
  const precedente = alCentimo(entrada.cumulatoPrecedente);
  const importo = alCentimo(cumulato - precedente);
  const finale = contratto > 0 && righe.every((r) => r.percentuale >= 100);

  // El anticipo se reparte en proporción a lo certificado. El último SAL se
  // lleva lo que quede, para que los redondeos de cada uno no dejen céntimos
  // sin recuperar.
  const pendiente = alCentimo(Math.max(0, entrada.acconti - entrada.accontoGiaRecuperato));
  const proporcional = contratto > 0 ? alCentimo((entrada.acconti * Math.max(0, importo)) / contratto) : 0;
  const recuperoAcconto = finale ? pendiente : Math.min(pendiente, proporcional);

  return {
    righe,
    contratto,
    cumulato,
    precedente,
    importo,
    recuperoAcconto,
    daFatturare: alCentimo(importo - recuperoAcconto),
    finale,
    errori: { fuoriRango, retrocede },
  };
}
