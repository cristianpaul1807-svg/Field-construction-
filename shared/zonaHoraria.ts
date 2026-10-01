/**
 * En qué día cae un instante, visto desde la obra.
 *
 * El servidor no vive donde vive el negocio. Si el día de un fichaje se mira
 * con su reloj, un turno que empieza a las 20:00 en Montreal —medianoche en
 * UTC— cuenta para el día siguiente, y las ocho horas de ese día se reparten
 * mal: la hora extra sale donde no tocaba, o no sale. Por eso el día se
 * calcula siempre en la zona horaria del negocio.
 *
 * No hay columna con la zona: se deduce del país y, en Canadá, de la
 * provincia, que es donde está la obra en un negocio pequeño. Un país que no
 * conocemos cae en UTC, que es lo que pasaba antes con todos.
 */

const POR_PROVINCIA_DE_CANADA: Record<string, string> = {
  QC: "America/Toronto", ON: "America/Toronto", NU: "America/Toronto",
  BC: "America/Vancouver", YT: "America/Whitehorse",
  AB: "America/Edmonton", NT: "America/Edmonton",
  SK: "America/Regina", MB: "America/Winnipeg",
  NS: "America/Halifax", NB: "America/Moncton", PE: "America/Halifax",
  NL: "America/St_Johns",
};

const POR_PAIS: Record<string, string> = {
  IT: "Europe/Rome", ES: "Europe/Madrid", FR: "Europe/Paris", DE: "Europe/Berlin", PT: "Europe/Lisbon",
  BE: "Europe/Brussels", NL: "Europe/Amsterdam", AT: "Europe/Vienna", IE: "Europe/Dublin", GB: "Europe/London",
  CH: "Europe/Zurich", RO: "Europe/Bucharest", PL: "Europe/Warsaw", GR: "Europe/Athens", MX: "America/Mexico_City",
  CO: "America/Bogota", PE: "America/Lima", CL: "America/Santiago", AR: "America/Argentina/Buenos_Aires",
  VE: "America/Caracas", EC: "America/Guayaquil", UY: "America/Montevideo", DO: "America/Santo_Domingo",
  BR: "America/Sao_Paulo", US: "America/New_York",
};

export function zonaHorariaDelNegocio(pais: string | null | undefined, provincia: string | null | undefined): string {
  if (!pais || pais === "CA") return POR_PROVINCIA_DE_CANADA[provincia ?? ""] ?? "America/Toronto";
  return POR_PAIS[pais] ?? "UTC";
}

/** La fecha (AAAA-MM-DD) de un instante en esa zona. */
export function fechaEnZona(instante: Date, zona: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(instante);
}

/** Cuántos minutos va la zona por delante de UTC en ese instante. */
function desfase(instante: Date, zona: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zona, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(instante).map((x) => [x.type, x.value])
  );
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((comoUtc - Math.floor(instante.getTime() / 1000) * 1000) / 60000);
}

/**
 * La medianoche del día de una fecha (AAAA-MM-DD) en esa zona, como instante.
 *
 * Se calcula dos veces porque el desfase de la medianoche puede no ser el del
 * mediodía: el día del cambio de hora tiene 23 o 25 horas.
 */
export function medianocheEnZona(fecha: string, zona: string): Date {
  const [a, m, d] = fecha.split("-").map(Number);
  const ingenuo = Date.UTC(a, m - 1, d);
  let instante = ingenuo - desfase(new Date(ingenuo), zona) * 60000;
  instante = ingenuo - desfase(new Date(instante), zona) * 60000;
  return new Date(instante);
}

/** Donde empieza y donde acaba el día de ese instante en esa zona. */
export function diaEnZona(instante: Date, zona: string): { desde: Date; hasta: Date; fecha: string } {
  const fecha = fechaEnZona(instante, zona);
  const [a, m, d] = fecha.split("-").map(Number);
  const siguiente = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
  return { desde: medianocheEnZona(fecha, zona), hasta: medianocheEnZona(siguiente, zona), fecha };
}
