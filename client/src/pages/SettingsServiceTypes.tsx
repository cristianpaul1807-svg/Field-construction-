import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useApi, apiFetch, serverMessage } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface Tipo {
  id: string;
  slug: string;
  letter: string;
  name: string | null;
  builtin: boolean;
}

/**
 * Los tipos de trabajo del negocio.
 *
 * Los cinco de casa cubren lo genérico, pero un techador factura "Toiture" y
 * un electricista "Filage". Meterlo todo en "Otro" es perder justo el dato
 * por el que se clasifica el trabajo — y el que acaba en el número de obra.
 */
export default function SettingsServiceTypes() {
  const { t } = useTranslation();
  const { data: tipos, loading, error, reload } = useApi<Tipo[]>("/api/service-types");

  const [nuevo, setNuevo] = useState("");
  const [letra, setLetra] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const [editando, setEditando] = useState<Tipo | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");

  const ocupadas = (tipos ?? []).map((x) => x.letter);

  const crear = async () => {
    if (!nuevo.trim()) return;
    setGuardando(true);
    setFallo(null);
    try {
      const res = await apiFetch("/api/service-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nuevo.trim(), letter: letra.trim() || undefined }),
      });
      if (!res.ok) throw new Error(serverMessage(await res.json().catch(() => null), t, t("serviceTypes.createError")));
      setNuevo("");
      setLetra("");
      setAbierto(false);
      reload();
    } catch (err) {
      setFallo(err instanceof Error ? err.message : t("serviceTypes.createError"));
    } finally {
      setGuardando(false);
    }
  };

  const renombrar = async () => {
    if (!editando || !nombreEditado.trim()) return;
    setGuardando(true);
    setFallo(null);
    try {
      const res = await apiFetch(`/api/service-types/${editando.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nombreEditado.trim() }),
      });
      if (!res.ok) throw new Error(serverMessage(await res.json().catch(() => null), t, t("common.genericError")));
      setEditando(null);
      reload();
    } catch (err) {
      setFallo(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (tipo: Tipo) => {
    if (!window.confirm(t("serviceTypes.deleteConfirm", { name: tipo.name ?? tipo.slug }))) return;
    setFallo(null);
    const res = await apiFetch(`/api/service-types/${tipo.id}`, { method: "DELETE" });
    if (res.ok) {
      reload();
      return;
    }
    const cuerpo = await res.json().catch(() => null);
    // "Está en uso" no es un error del usuario, es la razón por la que no se
    // puede: se dice cuántos trabajos lo llevan para que se entienda.
    setFallo(
      cuerpo?.code === "service_type_in_use"
        ? t("serviceTypes.inUse", { count: cuerpo.count })
        : serverMessage(cuerpo, t, t("common.genericError"))
    );
  };

  const nombreDe = (tipo: Tipo) =>
    tipo.name ?? t(`worker.serviceTypes.${tipo.slug}`, { defaultValue: tipo.slug });

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title={t("serviceTypes.title")}
        description={t("serviceTypes.description")}
        action={
          <Dialog open={abierto} onOpenChange={(v) => { setAbierto(v); if (!v) { setFallo(null); setNuevo(""); setLetra(""); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus size={16} /> {t("serviceTypes.newType")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("serviceTypes.newType")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tipo-nombre">{t("common.name")}</Label>
                  <Input
                    id="tipo-nombre"
                    value={nuevo}
                    onChange={(e) => setNuevo(e.target.value)}
                    placeholder={t("serviceTypes.namePlaceholder")}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tipo-letra">
                    {t("serviceTypes.letter")}{" "}
                    <span className="font-normal text-muted-foreground">{t("common.optional")}</span>
                  </Label>
                  <Input
                    id="tipo-letra"
                    value={letra}
                    onChange={(e) => setLetra(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 1).toLowerCase())}
                    placeholder={t("serviceTypes.letterAuto")}
                    className="w-20 font-mono"
                  />
                  <p className="text-xs text-muted-foreground">{t("serviceTypes.letterHint")}</p>
                  {/* Las que ya están cogidas, para no elegir a ciegas. */}
                  <p className="text-xs text-muted-foreground">
                    {t("serviceTypes.lettersTaken", { letters: ocupadas.slice().sort().join(" · ") })}
                  </p>
                </div>
                {fallo && (
                  <div className="rounded-lg border border-border bg-status-error-bg/40 p-3 text-sm text-status-error-fg">{fallo}</div>
                )}
                <Button className="w-full" onClick={crear} disabled={guardando || !nuevo.trim()}>
                  {guardando ? <Spinner className="size-4" /> : t("serviceTypes.create")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          {t("common.loadError", { message: error })}
        </div>
      )}
      {!abierto && fallo && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">{fallo}</div>
      )}

      {!loading && !error && (
        <Card className="p-2">
          {(tipos ?? []).map((tipo) => (
            <div key={tipo.id} className="flex items-center gap-3 p-3 border-b border-border last:border-0">
              {/* La letra va primero y en monoespaciada: es lo que aparece
                  dentro del número de obra, y así se relaciona de un vistazo. */}
              <code className="font-mono text-sm font-semibold w-8 h-8 flex items-center justify-center rounded bg-secondary flex-shrink-0">
                {tipo.letter}
              </code>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{nombreDe(tipo)}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{tipo.slug}</p>
              </div>
              {tipo.builtin ? (
                <StatusBadge tone="neutral">{t("serviceTypes.builtin")}</StatusBadge>
              ) : (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    aria-label={t("common.edit")}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    onClick={() => { setFallo(null); setEditando(tipo); setNombreEditado(tipo.name ?? ""); }}
                  >
                    <Pencil size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    aria-label={t("common.delete")}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-status-error-fg hover:bg-secondary transition-colors"
                    onClick={() => borrar(tipo)}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {tipos?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t("serviceTypes.empty")}</p>
          )}
        </Card>
      )}

      {/* Por qué los de casa no se tocan: su nombre se traduce a cuatro
          idiomas, y el trabajador lo lee en el suyo. */}
      <p className="text-xs text-muted-foreground">{t("serviceTypes.builtinHint")}</p>

      <Dialog open={editando !== null} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("serviceTypes.rename")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipo-renombrar">{t("common.name")}</Label>
              <Input
                id="tipo-renombrar"
                value={nombreEditado}
                onChange={(e) => setNombreEditado(e.target.value)}
                autoFocus
              />
            </div>
            {/* Se puede cambiar cómo se llama, no su letra: esa está dentro de
                números de obra ya emitidos y un número emitido no se mueve. */}
            <p className="text-xs text-muted-foreground">
              {t("serviceTypes.renameHint", { letter: editando?.letter ?? "" })}
            </p>
            {fallo && (
              <div className="rounded-lg border border-border bg-status-error-bg/40 p-3 text-sm text-status-error-fg">{fallo}</div>
            )}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={renombrar} disabled={guardando || !nombreEditado.trim()}>
                {guardando ? <Spinner className="size-4" /> : t("common.save")}
              </Button>
              <Button variant="outline" onClick={() => setEditando(null)}>{t("common.cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
