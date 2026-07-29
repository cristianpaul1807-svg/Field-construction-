import { Link } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, projectStatusTone } from "@/components/StatusBadge";
import { Plus } from "lucide-react";
import { projectStatusLabel, formatCurrency, type ProjectStatus } from "@/lib/mockData";
import { useApi } from "@/lib/api";

interface Project {
  id: string;
  clientName: string | null;
  name: string;
  type: string;
  status: ProjectStatus;
  progressPercent: number;
  budgetTotal: number;
  budgetUsed: number;
  team: string[];
}

export default function Projects() {
  const { data: projects, loading, error } = useApi<Project[]>("/api/projects");

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Projects"
        description="Hub central de cada proyecto"
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Plus size={16} /> New Project
          </Button>
        }
      />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Cargando proyectos...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          No se pudo cargar desde Supabase: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="p-5 hover:border-primary/40 transition-colors cursor-pointer h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{project.type}</p>
                    <h3 className="font-semibold text-foreground mt-0.5 truncate">{project.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{project.clientName}</p>
                  </div>
                  <StatusBadge tone={projectStatusTone[project.status]}>
                    {projectStatusLabel[project.status]}
                  </StatusBadge>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Progreso</span>
                    <span>{project.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${project.progressPercent}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 text-sm">
                  <span className="text-muted-foreground">
                    {formatCurrency(project.budgetUsed)} / {formatCurrency(project.budgetTotal)}
                  </span>
                  <div className="flex -space-x-2">
                    {project.team.slice(0, 3).map((member) => (
                      <div
                        key={member}
                        className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center border-2 border-card"
                        title={member}
                      >
                        {member.charAt(0)}
                      </div>
                    ))}
                    {project.team.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-secondary text-[10px] font-semibold flex items-center justify-center border-2 border-card">
                        +{project.team.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {projects?.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-8">
              Este negocio todavía no tiene proyectos.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
