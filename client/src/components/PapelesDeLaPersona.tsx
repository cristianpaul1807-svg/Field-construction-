import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Download, Trash2, EyeOff } from "lucide-react";
import { useApi, apiFetch, readJson, serverMessage, apiEnviar } from "@/lib/api";
import { AvisoDeFallo } from "@/components/AvisoDeFallo";

const TIPOS = ["contrato", "t4", "rl1", "talon", "otro"] as const;

interface Papel {
  id: string;
  kind: string;
  name: string;
  year: number | null;
  note: string | null;
  visibleToWorker: boolean;
  uploadedAt: string;
}

/**
 * Los papeles de una persona.
 *
 * El contrato que se firmó fuera, el T4, el RL-1, el talón de pago. Casi todos
 * los genera QuickBooks Payroll, que no tiene API pública: no se pueden traer
 * solos. Pero pueden **vivir aquí**, junto a sus horas y su acuerdo, en vez de
 * en un correo que en marzo no encuentra nadie.
 *
 * Y los ve la persona en su móvil, que es la mitad del valor: el T4 se manda
 * cada febrero, se pierde, y la oficina lo vuelve a buscar en abril.
 *
 * **No leemos los números de dentro del PDF.** Sacar el sueldo de un T4 con un
 * lector automático acierta casi siempre, y «casi siempre» en una cifra que va
 * a una declaración es peor que no tenerla.
 */
export function PapelesDeLaPersona({
  kind,
  workerId,
  workerName,
  onClose,
}: {
  kind: "employee" | "subcontractor";
  workerId: string;
  workerName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [recarga, setRecarga] = useState(0);
  const parametro = kind === "employee" ? "employeeId" : "subcontractorId";
  const { data: papeles, loading, error, detalle, reload } = useApi<Papel[]>(
    `/api/worker-documents?${parametro}=${workerId}&_r=${recarga}`
  );

  const [subiendo, setSubiendo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("t4");
  const [anio, setAnio] = useState(String(new Date().getFullYear() - 1));
  const [suyo, setSuyo] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const refrescar = () => {
    setRecarga((n) => n + 1);
    reload();
  };

  const subir = async () => {
    if (!archivo) return;
    setSubiendo(true);
    setFallo(null);
    try {
      const cuerpo = new FormData();
      cuerpo.append("file", archivo);
      cuerpo.append(parametro, workerId);
      cuerpo.append("kind", tipo);
      // El año sólo donde significa algo: un contrato no se busca por año
      // fiscal, un T4 sí.
      if (tipo === "t4" || tipo === "rl1") cuerpo.append("year", anio);
      cuerpo.append("visibleToWorker", String(suyo));

      const res = await apiFetch("/api/worker-documents", { method: "POST", body: cuerpo });
      const body = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(body, t, t("workerDocs.uploadError")));
      setArchivo(null);
      refrescar();
    } catch (err) {
      setFallo(err instanceof Error ? err.message : t("workerDocs.uploadError"));
    } finally {
      setSubiendo(false);
    }
  };

  const descargar = async (papel: Papel) => {
    setOcupado(papel.id);
    try {
      const res = await apiFetch(`/api/worker-documents/${papel.id}/download-url`);
      const body = await readJson<{ url?: string; error?: string; code?: string }>(res);
      if (res.ok && body.url) window.open(body.url, "_blank", "noopener");
      else setFallo(serverMessage(body, t, t("common.genericError")));
    } finally {
      setOcupado(null);
    }
  };

  const cambiarVisibilidad = async (papel: Papel) => {
    setOcupado(papel.id);
    await apiEnviar(`/api/worker-documents/${papel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibleToWorker: !papel.visibleToWorker }),
    }).catch(() => null);
    setOcupado(null);
    refrescar();
  };

  const borrar = async (papel: Papel) => {
    setOcupado(papel.id);
    await apiEnviar(`/api/worker-documents/${papel.id}`, { method: "DELETE" }).catch(() => null);
    setOcupado(null);
    refrescar();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("workerDocs.title", { name: workerName })}</DialogTitle>
          <DialogDescription>{t("workerDocs.hint")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="papel-tipo">{t("workerDocs.kind")}</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as (typeof TIPOS)[number])}>
                <SelectTrigger id="papel-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((x) => (
                    <SelectItem key={x} value={x}>{t(`workerDocs.kinds.${x}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(tipo === "t4" || tipo === "rl1") && (
              <div className="space-y-1.5">
                <Label htmlFor="papel-anio">{t("workerDocs.year")}</Label>
                <Input
                  id="papel-anio"
                  type="number"
                  min={2000}
                  max={2100}
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="papel-archivo">{t("workerDocs.file")}</Label>
            <Input
              id="papel-archivo"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <Checkbox checked={suyo} onCheckedChange={(v) => setSuyo(v === true)} />
            <span className="min-w-0">
              <span className="block text-sm text-foreground">{t("workerDocs.shareWithWorker")}</span>
              <span className="block text-xs text-muted-foreground">{t("workerDocs.shareWithWorkerHint")}</span>
            </span>
          </label>

          {fallo && <p className="text-sm text-status-error-fg">{fallo}</p>}

          <Button className="gap-2" onClick={subir} disabled={!archivo || subiendo}>
            {subiendo ? <Spinner className="size-4" /> : <Upload size={15} strokeWidth={1.75} />}
            {t("workerDocs.upload")}
          </Button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Spinner className="size-4" /> {t("common.loading")}
          </div>
        )}
        {error && <AvisoDeFallo mensaje={error} detalle={detalle} onReintentar={refrescar} />}

        {!loading && !error && (
          <div className="divide-y divide-border">
            {(papeles ?? []).map((papel) => (
              <div key={papel.id} className="py-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    {t(`workerDocs.kinds.${papel.kind}`, { defaultValue: papel.kind })}
                    {papel.year && <span className="text-muted-foreground"> · {papel.year}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{papel.name}</p>
                  {!papel.visibleToWorker && (
                    <p className="text-xs text-status-warning-fg inline-flex items-center gap-1 mt-0.5">
                      <EyeOff size={11} /> {t("workerDocs.hiddenFromWorker")}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 sm:min-h-0"
                    aria-label={t("workerDocs.download")}
                    onClick={() => descargar(papel)}
                    disabled={ocupado !== null}
                  >
                    {ocupado === papel.id ? <Spinner className="size-3.5" /> : <Download size={14} />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 sm:min-h-0"
                    aria-label={papel.visibleToWorker ? t("workerDocs.hide") : t("workerDocs.share")}
                    onClick={() => cambiarVisibilidad(papel)}
                    disabled={ocupado !== null}
                  >
                    <EyeOff size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 sm:min-h-0 text-status-error-fg"
                    aria-label={t("common.delete")}
                    onClick={() => borrar(papel)}
                    disabled={ocupado !== null}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
            {(papeles ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">{t("workerDocs.empty")}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
