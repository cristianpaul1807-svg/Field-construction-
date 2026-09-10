/**
 * Cuánto duró un turno, contado en un solo sitio.
 *
 * Estaba escrito dos veces y no daban lo mismo: la lista de fichajes redondeaba
 * al minuto más cercano y el mapa truncaba hacia abajo. Un turno de 6,77
 * minutos salía como "0 h 07" en una pantalla y "0:06" en la otra, y uno de 45
 * segundos salía como "0 h 01" y "0:00" — este último se lee como que el
 * fichaje no contó nada, que es justo lo que un trabajador va a reclamar.
 *
 * Ninguna de las dos alimenta la nómina: las horas que se pagan se calculan en
 * el servidor a partir de las marcas, en decimales y sin pasar por esto. Aquí
 * sólo se decide cómo se escribe.
 */

/** Los minutos del turno, al minuto más cercano. */
export function minutosDeTurno(desdeIso: string, hastaIso: string | null): number | null {
  const fin = hastaIso ? new Date(hastaIso).getTime() : Date.now();
  const ms = fin - new Date(desdeIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60_000);
}

/**
 * El turno escrito. Un turno más corto que medio minuto redondearía a cero, y
 * un cero se lee como "no contó": se dice que fue menos de un minuto, que es
 * la verdad y no parece un fallo.
 */
export function duracionDeTurno(
  desdeIso: string,
  hastaIso: string | null,
  t: (key: string) => string
): string | null {
  const minutos = minutosDeTurno(desdeIso, hastaIso);
  if (minutos === null) return null;
  if (minutos === 0) {
    const fin = hastaIso ? new Date(hastaIso).getTime() : Date.now();
    const ms = fin - new Date(desdeIso).getTime();
    return ms > 0 ? t("common.lessThanAMinute") : `0 h 00`;
  }
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")}`;
}
