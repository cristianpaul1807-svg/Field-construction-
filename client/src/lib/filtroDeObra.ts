import { useSelectedProject } from "@/contexts/SelectedProjectContext";

/**
 * Filtrar una lista por la obra elegida arriba.
 *
 * Sin obra elegida —"General"— devuelve la lista entera. Ese es el
 * comportamiento por defecto a propósito: el jefe que no ha tocado el selector
 * quiere ver su negocio, no una pantalla vacía pidiéndole que elija algo.
 *
 * Está aquí y no repetido en cada pantalla porque la regla tiene que ser la
 * misma en las catorce: una pantalla que filtrara al revés, o que exigiera
 * elegir, convertiría el selector en algo en lo que no se puede confiar.
 */
export function useFiltroDeObra() {
  const { selectedProjectId, selectedProject } = useSelectedProject();

  return {
    obraId: selectedProjectId,
    obra: selectedProject,
    hayFiltro: Boolean(selectedProjectId),
    /** Filtra por el id de obra que lleve cada fila. */
    filtrar<T>(filas: T[] | null | undefined, idDeLaFila: (f: T) => string | null | undefined): T[] {
      const todas = filas ?? [];
      if (!selectedProjectId) return todas;
      return todas.filter((f) => idDeLaFila(f) === selectedProjectId);
    },
  };
}
