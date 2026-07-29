import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Upload } from "lucide-react";
import { useApi } from "@/lib/api";

interface Photo {
  id: string;
  projectId: string;
  projectName: string | null;
  zone: string;
  timestamp: string;
  visibleToClient: boolean;
  uploadedBy: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `oklch(0.74 0.07 ${hash % 360})`;
}

export default function PhotoGallery() {
  const { data: photos, loading, error } = useApi<Photo[]>("/api/photos");
  const { data: projects } = useApi<ProjectOption[]>("/api/projects");
  const [projectFilter, setProjectFilter] = useState<string | "all">("all");

  const filtered = (photos ?? []).filter((p) => projectFilter === "all" || p.projectId === projectFilter);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Photo Gallery"
        description="Organizada por fecha y zona, con visibilidad al cliente"
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Upload size={16} /> Subir fotos
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setProjectFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${projectFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:bg-secondary"}`}
        >
          Todos los proyectos
        </button>
        {projects?.map((p) => (
          <button
            key={p.id}
            onClick={() => setProjectFilter(p.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${projectFilter === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:bg-secondary"}`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Cargando fotos...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          No se pudo cargar desde Supabase: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((photo) => (
            <Card key={photo.id} className="p-3 space-y-2">
              <div className="aspect-square rounded-lg border border-border" style={{ background: colorForId(photo.id) }} />
              <div>
                <p className="text-sm text-foreground truncate">{photo.projectName}</p>
                <p className="text-xs text-muted-foreground">{photo.zone} · {photo.timestamp?.slice(0, 10)}</p>
                <p className="text-xs text-muted-foreground">Subida por {photo.uploadedBy ?? "—"}</p>
              </div>
              <StatusBadge tone={photo.visibleToClient ? "success" : "neutral"}>
                {photo.visibleToClient ? "Visible al cliente" : "Interno"}
              </StatusBadge>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-8">Sin fotos para este filtro.</p>
          )}
        </div>
      )}
    </div>
  );
}
