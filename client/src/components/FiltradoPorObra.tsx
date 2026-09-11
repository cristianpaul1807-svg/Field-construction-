import { FolderKanban, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelectedProject } from "@/contexts/SelectedProjectContext";
import { cn } from "@/lib/utils";

/**
 * El aviso de que lo que se está viendo no es todo.
 *
 * El selector de obra vive en la cabecera, pequeño y lejos de la lista. Sin
 * este aviso, quien deja una obra elegida y al día siguiente abre Facturación
 * ve tres facturas donde hay veinte y piensa que se han perdido. Un filtro que
 * no se ve es indistinguible de un fallo.
 *
 * Con "General" no pinta nada: no hay nada que avisar cuando se está viendo
 * todo.
 */
export function FiltradoPorObra({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { selectedProject, setSelectedProjectId } = useSelectedProject();

  if (!selectedProject) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm",
        className
      )}
    >
      <FolderKanban size={15} className="text-muted-foreground flex-shrink-0" />
      <span className="text-muted-foreground">{t("scope.filteredBy")}</span>
      <span className="font-medium text-foreground">{selectedProject.name}</span>
      <button
        onClick={() => setSelectedProjectId(null)}
        className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={13} /> {t("scope.seeAll")}
      </button>
    </div>
  );
}
