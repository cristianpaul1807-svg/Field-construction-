import { useApi } from "@/lib/api";
import type { TFunction } from "i18next";

/**
 * Un tipo de trabajo del negocio, con la letra que pone en el número de obra.
 *
 * `name` nulo es uno de los de casa y se traduce; con nombre escrito es uno
 * que dio de alta el negocio y se enseña tal cual, porque nadie va a traducir
 * a cuatro idiomas lo que escriba un contratista.
 */
export interface TipoDeTrabajo {
  slug: string;
  letter: string;
  name: string | null;
}

/**
 * La lista estaba escrita a mano en tres pantallas distintas. Ahora sale de
 * la misma tabla que usa la base al emitir el número de obra: si el
 * desplegable dijera una letra y la base escribiera otra, el número dejaría
 * de querer decir nada.
 */
export function useTiposDeTrabajo() {
  return useApi<TipoDeTrabajo[]>("/api/service-types");
}

/** Cómo se llama un tipo en pantalla. */
export function nombreDeTipo(tipo: TipoDeTrabajo, t: TFunction) {
  return tipo.name ?? t(`worker.serviceTypes.${tipo.slug}`, { defaultValue: tipo.slug });
}

/**
 * Lo mismo pero partiendo del slug guardado, que es lo que hay en la mayoría
 * de las pantallas. Un slug que ya no está en la tabla se enseña crudo antes
 * que desaparecer: un hueco no se distingue de un dato que no se pidió.
 */
export function nombreDeSlug(slug: string | null, tipos: TipoDeTrabajo[] | null, t: TFunction) {
  if (!slug) return t("worker.serviceTypes.sin_especificar");
  const tipo = tipos?.find((x) => x.slug === slug);
  return tipo ? nombreDeTipo(tipo, t) : t(`worker.serviceTypes.${slug}`, { defaultValue: slug });
}
