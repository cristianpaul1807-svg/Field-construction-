import { FolderKanban, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useSelectedProject } from "@/contexts/SelectedProjectContext";
import { Link } from "wouter";

/**
 * Lo que se ve en las pantallas que necesitan una obra concreta.
 *
 * Antes decía "usa el selector de la barra de arriba" y ahí terminaba: quien
 * entra por primera vez —el caso de nuestro primer cliente— se queda mirando
 * una tarjeta vacía buscando un desplegable que no ha visto. Las obras ya
 * están cargadas en el contexto, así que se eligen aquí mismo, que es donde
 * está la persona.
 *
 * Y si no hay ninguna obra todavía, el problema no es que no haya elegido:
 * es que no tiene obras. Eso se dice, y se ofrece crear una.
 */
export function SelectProjectPrompt() {
  const { t } = useTranslation();
  const { projects, projectsLoading, projectsError, setSelectedProjectId } = useSelectedProject();

  if (projectsLoading) {
    return (
      <Card className="p-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("common.loading")}
      </Card>
    );
  }

  // No poder leer la lista no es lo mismo que no tener obras, y decir lo
  // segundo cuando pasa lo primero manda a crear algo que quizá ya existe.
  if (projectsError) {
    return (
      <Card className="p-12 flex flex-col items-center justify-center text-center gap-2">
        <FolderKanban size={28} className="text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{t("common.selectProject")}</p>
        <p className="text-xs text-muted-foreground max-w-xs">{t("common.selectProjectHint")}</p>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="p-12 flex flex-col items-center justify-center text-center gap-2">
        <FolderKanban size={28} className="text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{t("common.noProjectsYet")}</p>
        <p className="text-xs text-muted-foreground max-w-xs">{t("common.noProjectsYetHint")}</p>
        <Link href="/projects" className="text-xs text-primary hover:underline mt-1">
          {t("common.goToProjects")}
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col items-center text-center gap-1.5 mb-5">
        <FolderKanban size={26} className="text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{t("common.selectProject")}</p>
        <p className="text-xs text-muted-foreground max-w-xs">{t("common.selectProjectHere")}</p>
      </div>

      <div className="max-w-md mx-auto divide-y divide-border rounded-lg border border-border overflow-hidden">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => setSelectedProjectId(project.id)}
            className="w-full min-h-11 px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-secondary transition-colors"
          >
            <span className="text-sm text-foreground truncate">{project.name}</span>
            <ChevronRight size={15} strokeWidth={1.75} className="text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </Card>
  );
}
