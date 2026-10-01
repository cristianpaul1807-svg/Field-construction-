/**
 * Por qué no está alguien un día.
 *
 * Una sola lista para el panel, la app del trabajador y el servidor; la base
 * de datos tiene la misma en `time_off_kind_check`. Son el dato que se guarda,
 * en castellano, y se traducen al enseñarlos (`timeOff.kind.<tipo>`).
 *
 * `maltempo` e `infortunio` llegaron con Italia y valen en todas partes. En
 * la construcción italiana las horas perdidas por mal tiempo las paga el INPS
 * por la cassa integrazione, y el consulente del lavoro las necesita aparte de
 * las vacaciones para hacer la nómina; en Quebec la CCQ también separa las
 * intemperies. Un accidente de trabajo no es una baja por enfermedad en
 * ningún país: lo cubre otro (INAIL, CNESST) y se declara distinto.
 */
export const TIPOS_DE_AUSENCIA = ["vacaciones", "enfermedad", "permiso", "festivo", "maltempo", "infortunio"] as const;
export type TipoDeAusencia = (typeof TIPOS_DE_AUSENCIA)[number];

export function esTipoDeAusencia(valor: unknown): valor is TipoDeAusencia {
  return typeof valor === "string" && (TIPOS_DE_AUSENCIA as readonly string[]).includes(valor);
}
