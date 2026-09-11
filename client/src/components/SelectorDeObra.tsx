import { useState } from "react";
import { FolderKanban, ChevronDown, Check, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSelectedProject } from "@/contexts/SelectedProjectContext";
import { cn } from "@/lib/utils";

/**
 * El selector de obra, dentro de la pantalla que filtra.
 *
 * Vivía en la cabecera, pequeño y lejos de las listas. Dos problemas: no se
 * veía —quien dejaba una obra elegida un martes, el jueves creía que le
 * faltaban facturas— y ocupaba en la barra el sitio que necesitaban las
 * secciones del menú.
 *
 * Aquí está encima de los datos que filtra, así que no hay estado escondido:
 * lo que se está viendo y por qué se leen de un vistazo. Y como se pone justo
 * donde hace falta, sólo aparece en las pantallas que de verdad filtran.
 *
 * La obra elegida es una sola para todo el panel, no una por pantalla. Quien
 * pasa la mañana con una obra recorre facturas, fichajes y horas sin volver a
 * elegirla en cada sitio.
 */
export function SelectorDeObra({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { projects, projectsLoading, projectsError, selectedProjectId, selectedProject, setSelectedProjectId, reloadProjects } =
    useSelectedProject();
  const [busqueda, setBusqueda] = useState("");

  // Con dos obras el buscador estorba; con veinte, la lista no se recorre.
  const conBuscador = projects.length > 8;
  const sinAcentos = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const aguja = sinAcentos(busqueda.trim());
  const visibles = aguja ? projects.filter((p) => sinAcentos(p.name).includes(aguja)) : projects;

  const elegir = (id: string | null) => {
    setSelectedProjectId(id);
    setBusqueda("");
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <span className="text-sm text-muted-foreground">{t("scope.label")}</span>

      <DropdownMenu
        // Abrirlo vuelve a pedir la lista si la anterior falló: es el único
        // momento en que alguien mira este control.
        onOpenChange={(open) => {
          if (open && projectsError) reloadProjects();
          if (!open) setBusqueda("");
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t("scope.filterByProject")}
            className={cn(
              "inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-sm transition-colors max-w-full",
              // Con filtro puesto el control se marca. Es lo que sustituye al
              // aviso que había antes: el propio selector dice que no se está
              // viendo todo, sin ocupar una línea aparte.
              selectedProject
                ? "border-primary bg-secondary text-foreground font-medium"
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            )}
          >
            <FolderKanban size={15} className="flex-shrink-0" />
            <span className="truncate">{selectedProject ? selectedProject.name : t("common.generalScope")}</span>
            <ChevronDown size={14} className="flex-shrink-0 opacity-60" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72">
          {conBuscador && (
            <div className="p-1.5">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder={t("scope.searchProject")}
                  className="pl-8 h-8 text-sm"
                  // El menú se cierra con las flechas y la barra espaciadora
                  // si no se le dice que aquí se está escribiendo.
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <DropdownMenuItem onClick={() => elegir(null)} className={cn("gap-2", !selectedProjectId && "bg-secondary")}>
            <Check size={14} className={cn("flex-shrink-0", selectedProjectId && "opacity-0")} />
            <span>{t("common.generalScope")}</span>
          </DropdownMenuItem>

          {visibles.length > 0 && <DropdownMenuSeparator />}

          <div className="max-h-72 overflow-y-auto">
            {projectsLoading && <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("common.loading")}</div>}
            {/* "No hay obras" y "no pude leer la lista" no son lo mismo, y
                decir lo primero cuando pasa lo segundo manda a crear algo que
                ya existe. */}
            {!projectsLoading && projectsError && (
              <div className="px-2 py-1.5 text-xs text-status-error-fg">
                {t("common.loadError", { message: projectsError })}
              </div>
            )}
            {!projectsLoading && !projectsError && projects.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("worker.noProjects")}</div>
            )}
            {!projectsLoading && !projectsError && projects.length > 0 && visibles.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t("scope.noMatches", { query: busqueda.trim() })}
              </div>
            )}
            {visibles.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => elegir(project.id)}
                className={cn("gap-2", selectedProjectId === project.id && "bg-secondary")}
              >
                <Check size={14} className={cn("flex-shrink-0", selectedProjectId !== project.id && "opacity-0")} />
                <span className="truncate">{project.name}</span>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedProject && (
        <button
          onClick={() => elegir(null)}
          className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
        >
          {t("scope.seeAll")}
        </button>
      )}
    </div>
  );
}
