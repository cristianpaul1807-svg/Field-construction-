import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Upload, FileText } from "lucide-react";
import { documents, findProject } from "@/lib/mockData";

const tagTone: Record<string, "info" | "warning" | "neutral" | "success"> = {
  contrato: "success",
  permiso: "info",
  plano: "neutral",
  garantia: "warning",
};

export default function Contracts() {
  const [query, setQuery] = useState("");
  const filtered = documents.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Contracts & Documents"
        description="Repositorio de archivos por proyecto — contratos, permisos, planos, garantías"
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Upload size={16} /> Upload
          </Button>
        }
      />

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search size={16} className="text-muted-foreground" />
          <Input placeholder="Buscar documento..." value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
        </div>
        <div className="space-y-2">
          {filtered.map((doc) => {
            const project = findProject(doc.projectId);
            return (
              <div key={doc.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={18} className="text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{project?.name} · {doc.uploadedAt} · {doc.sizeKb} KB</p>
                  </div>
                </div>
                <StatusBadge tone={tagTone[doc.tag]} className="capitalize flex-shrink-0">{doc.tag}</StatusBadge>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No se encontraron documentos.</p>
          )}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Almacenamiento en la nube (S3 / Google Cloud Storage) se conecta en Fase B junto con Supabase.
      </p>
    </div>
  );
}
