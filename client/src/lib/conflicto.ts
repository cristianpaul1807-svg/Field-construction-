/**
 * El mensaje cuando alguien ya está ocupado a esa hora.
 *
 * Existe aparte porque lo necesitan dos pantallas —la agenda y las órdenes de
 * trabajo— y porque un choque no se cuenta con una frase fija: hay que decir
 * con qué choca, a qué hora y en qué obra. "No se pudo guardar" obliga a salir,
 * buscar el calendario de esa persona y adivinar cuál era el problema.
 */

export interface ChoqueDeAgenda {
  title: string;
  startTime: string;
  endTime: string;
  projectName: string | null;
  kind: "cita" | "orden";
}

export function mensajeDeChoque(
  body: { code?: string; conflict?: ChoqueDeAgenda } | null | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
  lang: string
): string | null {
  if (body?.code !== "worker_double_booked" || !body.conflict) return null;
  const c = body.conflict;
  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
  return t("scheduling.workerBusy", {
    title: c.title,
    from: hora(c.startTime),
    to: hora(c.endTime),
    // Sin obra la frase se queda coja, así que se cae a un guion en vez de
    // escribir "en null".
    project: c.projectName ?? "—",
  });
}
