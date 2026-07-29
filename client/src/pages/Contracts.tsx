import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { SelectProjectPrompt } from "@/components/SelectProjectPrompt";
import { Search, Upload, FileText } from "lucide-react";
import { useApi } from "@/lib/api";
import { useSelectedProject } from "@/contexts/SelectedProjectContext";

const tagTone: Record<string, "info" | "warning" | "neutral" | "success"> = {
  contrato: "success",
  permiso: "info",
  plano: "neutral",
  garantia: "warning",
};

interface Document {
  id: string;
  name: string;
  tag: string;
  uploadedAt: string;
  projectId: string | null;
  projectName: string | null;
}

export default function Contracts() {
  const { selectedProjectId, selectedProject } = useSelectedProject();
  const { data: documents, loading, error } = useApi<Document[]>("/api/documents");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      (documents ?? [])
        .filter((d) => d.projectId === selectedProjectId)
        .filter((d) => d.name.toLowerCase().includes(query.toLowerCase())),
    [documents, selectedProjectId, query]
  );

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Contracts & Documents"
        description={
          selectedProject
            ? `Archivos de ${selectedProject.name} — contratos, permisos, planos, garantías`
            : "Repositorio de archivos por proyecto — contratos, permisos, planos, garantías"
        }
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Upload size={16} /> Upload
          </Button>
        }
      />

      {!selectedProjectId && <SelectProjectPrompt />}

      {selectedProjectId && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Search size={16} className="text-muted-foreground" />
            <Input placeholder="Buscar documento..." value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Spinner className="size-4" /> Cargando documentos...
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
              No se pudo cargar desde Supabase: {error}
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-2">
              {filtered.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={18} className="text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.uploadedAt?.slice(0, 10)}</p>
                    </div>
                  </div>
                  <StatusBadge tone={tagTone[doc.tag]} className="capitalize flex-shrink-0">{doc.tag}</StatusBadge>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">Sin documentos para este proyecto.</p>
              )}
            </div>
          )}
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Los registros ya viven en Supabase; falta conectar el almacenamiento en la nube
        (S3 / Google Cloud Storage) para los archivos en sí — no es parte de esta fase.
      </p>
    </div>
  );
}
