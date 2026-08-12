import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { SelectProjectPrompt } from "@/components/SelectProjectPrompt";
import { Search, Upload, FileText, Download } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApi, apiFetch } from "@/lib/api";
import { useSelectedProject } from "@/contexts/SelectedProjectContext";
import { useTranslation } from "react-i18next";

const DOCUMENT_TAGS = ["contrato", "permiso", "plano", "garantia"] as const;

function UploadDocumentDialog({ projectId, onUploaded }: { projectId: string; onUploaded: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [tag, setTag] = useState<string>("contrato");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setFile(null); setName(""); setTag("contrato"); setError(null); };

  const upload = async () => {
    if (!file) return;
    setSaving(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      form.append("tag", tag);
      if (name.trim()) form.append("name", name.trim());
      // No Content-Type header: the browser sets the multipart boundary.
      const res = await apiFetch("/api/documents", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || t("contracts.uploadError"));
      setOpen(false); reset(); onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("contracts.uploadError"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 w-full sm:w-auto"><Upload size={16} /> {t("contracts.uploadDocument")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("contracts.uploadDocument")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("contracts.file")}</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("contracts.documentName")} ({t("common.optional")})</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={file?.name} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("contracts.tag")}</Label>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_TAGS.map((v) => <SelectItem key={v} value={v}>{t(`contracts.tags.${v}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={upload} disabled={!file || saving}>
            {saving ? t("contracts.uploading") : t("contracts.upload")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const { t } = useTranslation();
  const { selectedProjectId, selectedProject } = useSelectedProject();
  const [reloadToken, setReloadToken] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // The bucket is private, so a download is a short-lived signed URL rather
  // than a stored public link.
  const download = async (id: string) => {
    setDownloadingId(id);
    try {
      const res = await apiFetch(`/api/documents/${id}/download-url`, { method: "GET" });
      const body = await res.json();
      if (res.ok && body.url) window.open(body.url, "_blank", "noopener");
    } finally {
      setDownloadingId(null);
    }
  };
  const { data: documents, loading, error } = useApi<Document[]>(`/api/documents?_r=${reloadToken}`);
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
        title={t("contracts.title")}
        description={
          selectedProject
            ? `Archivos de ${selectedProject.name} — contratos, permisos, planos, garantías`
            : "Repositorio de archivos por proyecto — contratos, permisos, planos, garantías"
        }
        action={
          selectedProjectId ? (
            <UploadDocumentDialog projectId={selectedProjectId} onUploaded={() => setReloadToken((n) => n + 1)} />
          ) : undefined
        }
      />

      {!selectedProjectId && <SelectProjectPrompt />}

      {selectedProjectId && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Search size={16} className="text-muted-foreground" />
            <Input placeholder={t("contracts.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge tone={tagTone[doc.tag]}>{doc.tag ? t(`contracts.tags.${doc.tag}`) : "-"}</StatusBadge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => download(doc.id)}
                      disabled={downloadingId === doc.id}
                    >
                      {downloadingId === doc.id ? <Spinner className="size-3.5" /> : <Download size={13} />}
                      {t("contracts.download")}
                    </Button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">{t("contracts.noDocuments")}</p>
              )}
            </div>
          )}
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {t("contracts.storageNote")}
      </p>
    </div>
  );
}
