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
  const { projects, projectsLoading, selectedProjectId, selectedProject, setSelectedProjectId } =
    useSelectedProject();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-sm max-w-[220px]">
          <FolderKanban size={15} className="text-muted-foreground flex-shrink-0" />
          <span className={cn("truncate", !selectedProject && "text-muted-foreground")}>
            {selectedProject ? selectedProject.name : "Selecciona un proyecto"}
          </span>
          <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Proyectos</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {projectsLoading && <div className="px-2 py-1.5 text-xs text-muted-foreground">Cargando...</div>}
        {!projectsLoading && projects.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Sin proyectos todavía.</div>
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
              Deseleccionar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
