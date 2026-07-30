import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Trash2, Upload, FileText } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";

interface Category {
  id: string;
  name: string;
  createdAt: string;
}

interface ReferenceDocument {
  id: string;
  categoryId: string;
  categoryName: string | null;
  fileName: string;
  fileSize: number | null;
  uploadedAt: string;
}

const MAX_PER_CATEGORY = 5;

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BudgetCategoriesPanel() {
  const [reloadToken, setReloadToken] = useState(0);
  const { data: categories, loading: categoriesLoading } = useApi<Category[]>(
    `/api/budget-categories?_r=${reloadToken}`
  );
  const { data: documents, loading: documentsLoading } = useApi<ReferenceDocument[]>(
    `/api/estimate-reference-documents?_r=${reloadToken}`
  );

  const [newCategoryName, setNewCategoryName] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const refresh = () => setReloadToken((t) => t + 1);

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await apiFetch("/api/budget-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setNewCategoryName("");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeCategory = async (id: string) => {
    await apiFetch(`/api/budget-categories/${id}`, { method: "DELETE" });
    refresh();
  };

  const removeDocument = async (id: string) => {
    await apiFetch(`/api/estimate-reference-documents/${id}`, { method: "DELETE" });
    refresh();
  };

  const uploadDocument = async (categoryId: string, file: File) => {
    setUploadError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("categoryId", categoryId);
      form.append("file", file);
      const res = await apiFetch("/api/estimate-reference-documents", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "No se pudo subir el archivo");
      refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "No se pudo subir el archivo");
    } finally {
      setBusy(false);
    }
  };

  const loading = categoriesLoading || documentsLoading;

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="text-base font-semibold text-foreground mb-1">Categorías de presupuesto</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Define las categorías del negocio (cocina, reforma, construcción...). Cada presupuesto se etiqueta con una,
          y por cada categoría puedes subir hasta {MAX_PER_CATEGORY} presupuestos antiguos aprobados como referencia
          de márgenes y estructura — esto es lo que la futura IA especializada estudiará antes de redactar uno nuevo.
        </p>

        <div className="flex gap-2 mb-4">
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nueva categoría, ej. Techos"
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <Button className="gap-2 flex-shrink-0" onClick={addCategory} disabled={busy}>
            <Plus size={14} /> Crear
          </Button>
        </div>

        {uploadError && (
          <div className="rounded-lg border border-status-error-bg bg-status-error-bg/40 p-3 text-sm text-status-error-fg mb-4">
            {uploadError}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Cargando categorías...
          </div>
        )}

        {!loading && (categories ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">Todavía no hay categorías creadas.</p>
        )}

        {!loading && (
          <div className="space-y-3">
            {(categories ?? []).map((cat) => {
              const docs = (documents ?? []).filter((d) => d.categoryId === cat.id);
              const atLimit = docs.length >= MAX_PER_CATEGORY;
              return (
                <div key={cat.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{cat.name}</h3>
                      <span className="text-xs text-muted-foreground">
                        {docs.length}/{MAX_PER_CATEGORY} referencias
                      </span>
                    </div>
                    <button
                      onClick={() => removeCategory(cat.id)}
                      className="text-muted-foreground hover:text-status-error-fg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {docs.length === 0 && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Sin historial todavía — se usará como Assembly Template hasta que se acepte un presupuesto en
                      esta categoría.
                    </p>
                  )}

                  <div className="space-y-1.5 mb-3">
                    {docs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-foreground truncate">{doc.fileName}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{formatSize(doc.fileSize)}</span>
                        </div>
                        <button
                          onClick={() => removeDocument(doc.id)}
                          className="text-muted-foreground hover:text-status-error-fg flex-shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <input
                    ref={(el) => {
                      fileInputRefs.current[cat.id] = el;
                    }}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadDocument(cat.id, file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={atLimit || busy}
                    onClick={() => fileInputRefs.current[cat.id]?.click()}
                  >
                    <Upload size={14} /> {atLimit ? "Límite alcanzado" : "Subir presupuesto antiguo"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
