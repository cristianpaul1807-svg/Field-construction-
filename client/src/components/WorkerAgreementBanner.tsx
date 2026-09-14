import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileSignature, Download } from "lucide-react";
import { readJson, downloadFile, serverMessage } from "@/lib/api";
import { workerApiFetch } from "@/lib/workerSession";

/**
 * El acuerdo que espera su firma, arriba del todo.
 *
 * No es una pestaña más a propósito. La aplicación de campo tiene tres y son
 * toda su navegación: qué le toca, fichar, y hablar con la oficina. Una cuarta
 * que casi siempre estaría vacía le cobraría a todo el mundo, todos los días,
 * el sitio de algo que pasa dos veces al año.
 *
 * Así que aparece cuando hay algo que firmar y desaparece cuando se firma.
 */

interface Acuerdo {
  id: string;
  number: string;
  kind: "empleo" | "subcontrato";
  title: string | null;
  startDate: string;
  endDate: string | null;
  payKind: string;
  payAmount: number;
  payFrequency: string;
  status: string;
}

export function WorkerAgreementBanner({ workerName }: { workerName: string }) {
  const { t, i18n } = useTranslation();
  const [pendientes, setPendientes] = useState<Acuerdo[]>([]);
  const [abierto, setAbierto] = useState<Acuerdo | null>(null);
  const [nombre, setNombre] = useState(workerName);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await workerApiFetch("/api/worker/agreements");
      if (!res.ok) return;
      const body = await readJson<Acuerdo[]>(res);
      setPendientes((body ?? []).filter((a) => a.status === "enviado"));
    } catch {
      // Un acuerdo pendiente no puede tumbar la pantalla de fichar: si esto
      // falla, el trabajador sigue teniendo su jornada entera delante.
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const descargar = (a: Acuerdo) =>
    downloadFile(
      `/api/worker/agreements/${a.id}/pdf?download=1&lang=${i18n.language.slice(0, 2)}`,
      `${a.number}.pdf`,
      workerApiFetch
    );

  const firmar = async () => {
    if (!abierto) return;
    setOcupado(true);
    setError(null);
    try {
      const res = await workerApiFetch(`/api/worker/agreements/${abierto.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nombre.trim() }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(body, t, t("common.genericError")));
      setAbierto(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setOcupado(false);
    }
  };

  if (pendientes.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-status-warning-bg bg-status-warning-bg/40 p-4 space-y-3">
        {pendientes.map((a) => (
          <div key={a.id} className="space-y-2">
            <div className="flex items-start gap-2">
              <FileSignature size={18} className="text-status-warning-fg flex-shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{t("workerAgreements.pendingTitle")}</p>
                <p className="text-xs text-muted-foreground">
                  {a.title || t(`agreements.kind.${a.kind}`)} · {a.number}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="min-h-11 gap-1.5" onClick={() => descargar(a)}>
                <Download size={14} /> {t("workerAgreements.read")}
              </Button>
              <Button
                size="sm"
                className="min-h-11 gap-1.5"
                onClick={() => {
                  setNombre(workerName);
                  setError(null);
                  setAbierto(a);
                }}
              >
                <FileSignature size={14} /> {t("workerAgreements.sign")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!abierto} onOpenChange={(v) => !v && setAbierto(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("workerAgreements.signTitle")}</DialogTitle>
            <DialogDescription>{t("workerAgreements.signHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Leerlo antes de firmarlo tiene que estar aquí también: quien
                llega a esta pantalla desde el botón de firmar no ha vuelto
                atrás a buscar el PDF. */}
            {abierto && (
              <Button variant="outline" className="w-full min-h-11 gap-1.5" onClick={() => descargar(abierto)}>
                <Download size={14} /> {t("workerAgreements.read")}
              </Button>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="firma-nombre">{t("workerAgreements.yourName")}</Label>
              <Input
                id="firma-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoCapitalize="words"
                autoComplete="name"
              />
            </div>
            {error && <p className="text-sm text-status-error-fg">{error}</p>}
            <Button className="w-full min-h-11" onClick={firmar} disabled={ocupado || !nombre.trim()}>
              {ocupado ? <Spinner className="size-4" /> : t("workerAgreements.confirmSign")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
