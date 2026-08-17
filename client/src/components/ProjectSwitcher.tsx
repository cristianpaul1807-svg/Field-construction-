import { useTranslation } from "react-i18next";
import { ChevronDown, FolderKanban } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSelectedProject } from "@/contexts/SelectedProjectContext";
import { cn } from "@/lib/utils";

export function ProjectSwitcher() {
  const { t } = useTranslation();
  const {
    projects,
    projectsLoading,
    projectsError,
    selectedProjectId,
    selectedProject,
    setSelectedProjectId,
    reloadProjects,
  } = useSelectedProject();

  return (
    // Abrir el selector vuelve a pedir la lista si la anterior falló. Es el
    // único momento en que alguien mira este control, y es más barato que
    // pedirle que recargue la página para reintentar.
    <DropdownMenu onOpenChange={(open) => open && projectsError && reloadProjects()}>
      <DropdownMenuTrigger asChild>
        {/* On a narrow screen the label collapses to just the icon so the
            control still fits beside the rest of the header — it stays
            reachable rather than disappearing. */}
        <button className="flex items-center gap-2 px-2 sm:px-3 h-8 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-sm max-w-[9rem] sm:max-w-[220px]">
          <FolderKanban size={15} className="text-muted-foreground flex-shrink-0" />
          <span className={cn("truncate hidden sm:inline", !selectedProject && "text-muted-foreground")}>
            {selectedProject ? selectedProject.name : t("common.selectProject")}
          </span>
          <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{t("nav.projectsList")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {projectsLoading && <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("common.loading")}</div>}
        {/* "Sin proyectos" y "no pude leer la lista" se veían igual, y el
            segundo caso mandaba a crear un proyecto que ya existía. */}
        {!projectsLoading && projectsError && (
          <div className="px-2 py-1.5 text-xs text-status-error-fg">
            {t("common.loadError", { message: projectsError })}
          </div>
        )}
        {!projectsLoading && !projectsError && projects.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("worker.noProjects")}</div>
        )}
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => setSelectedProjectId(project.id)}
            className={cn(selectedProjectId === project.id && "bg-secondary")}
          >
            {project.name}
          </DropdownMenuItem>
        ))}
        {selectedProjectId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSelectedProjectId(null)} className="text-muted-foreground">
              {t("common.clearSelection")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
