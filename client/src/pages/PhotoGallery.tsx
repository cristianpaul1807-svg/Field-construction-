import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { SelectProjectPrompt } from "@/components/SelectProjectPrompt";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApi, apiFetch } from "@/lib/api";
import { useSelectedProject } from "@/contexts/SelectedProjectContext";
import { useTranslation } from "react-i18next";

interface Photo {
  id: string;
  projectId: string;
  projectName: string | null;
  zone: string;
  timestamp: string;
  visibleToClient: boolean;
  uploadedBy: string | null;
}

function UploadPhotoDialog({ projectId, onUploaded }: { projectId: string; onUploaded: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [zone, setZone] = useState("");
  const [visibleToClient, setVisibleToClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setFile(null); setZone(""); setVisibleToClient(false); setError(null); };

  const upload = async () => {
    if (!file) return;
    setSaving(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      if (zone.trim()) form.append("zone", zone.trim());
      form.append("visibleToClient", String(visibleToClient));
      const res = await apiFetch("/api/photos", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || t("photoGallery.uploadError"));
      setOpen(false); reset(); onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("photoGallery.uploadError"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 w-full sm:w-auto"><Upload size={16} /> {t("photoGallery.uploadPhoto")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("photoGallery.uploadPhoto")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("contracts.file")}</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("photoGallery.zone")} ({t("common.optional")})</Label>
            <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder={t("photoGallery.zonePlaceholder")} />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <Checkbox checked={visibleToClient} onCheckedChange={(c) => setVisibleToClient(c === true)} />
            {t("photoGallery.visibleToClient")}
          </label>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={upload} disabled={!file || saving}>
            {saving ? t("photoGallery.uploading") : t("photoGallery.upload")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Photos live in a private bucket, so each tile resolves its own short-lived
// signed URL rather than rendering a stored public link.
function PhotoThumb({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/photos/${id}/url`)
      .then((r) => r.json())
      .then((b) => { if (!cancelled && b?.url) setUrl(b.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  return url ? (
    <img src={url} alt="" className="aspect-square w-full object-cover rounded-lg border border-border" />
  ) : (
    <div className="aspect-square rounded-lg border border-border bg-secondary" />
  );
}

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `oklch(0.74 0.07 ${hash % 360})`;
}

export default function PhotoGallery() {
  const { t } = useTranslation();
  const { selectedProjectId, selectedProject } = useSelectedProject();
  const [reloadToken, setReloadToken] = useState(0);
  const { data: photos, loading, error } = useApi<Photo[]>(`/api/photos?_r=${reloadToken}`);

  const filtered = (photos ?? []).filter((p) => p.projectId === selectedProjectId);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={t("photoGallery.title")}
        description={
          selectedProject
            ? `Fotos de ${selectedProject.name}, organizadas por fecha y zona`
            : "Organizada por fecha y zona, con visibilidad al cliente"
        }
        action={
          selectedProjectId ? (
            <UploadPhotoDialog projectId={selectedProjectId} onUploaded={() => setReloadToken((n) => n + 1)} />
          ) : undefined
        }
      />

      {!selectedProjectId && <SelectProjectPrompt />}

      {selectedProjectId && loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}

      {selectedProjectId && error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          No se pudo cargar desde Supabase: {error}
        </div>
      )}

      {selectedProjectId && !loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((photo) => (
            <Card key={photo.id} className="p-3 space-y-2">
              <PhotoThumb id={photo.id} />
              <div>
                <p className="text-xs text-muted-foreground">{photo.zone} · {photo.timestamp?.slice(0, 10)}</p>
                <p className="text-xs text-muted-foreground">Subida por {photo.uploadedBy ?? "—"}</p>
              </div>
              <StatusBadge tone={photo.visibleToClient ? "success" : "neutral"}>
                {photo.visibleToClient ? "Visible al cliente" : "Interno"}
              </StatusBadge>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-8">{t("photoGallery.noPhotos")}</p>
          )}
        </div>
      )}
    </div>
  );
}
