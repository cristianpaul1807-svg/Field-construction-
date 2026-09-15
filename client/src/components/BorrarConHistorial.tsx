import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiFetch, readJson, serverMessage } from "@/lib/api";

/**
 * Borrar algo que puede tener historial detrás.
 *
 * Casi todo lo que se borra en este producto tiene la misma forma: confirmar,
 * llamar, y que el servidor pueda decir que no porque eso ya tiene documentos
 * colgando. Estaba escrito una vez en Técnicos y hacía falta en cuatro sitios
 * más; copiarlo cuatro veces es cómo se acaba con cuatro comportamientos
 * distintos para la misma pregunta.
 *
 * **Cuando el servidor se niega, el botón de borrar desaparece.** Dejarlo ahí
 * invita a pulsarlo otra vez esperando un resultado distinto. Lo que queda es
 * el motivo y la salida.
 *
 * El motivo lo traduce `serverMessage` por el código que manda el servidor, así
 * que añadir un caso nuevo es añadir su texto en los cuatro idiomas y no tocar
 * esto.
 */
export function BorrarConHistorial({
  titulo,
  confirmacion,
  ruta,
  onBorrado,
  onCerrar,
}: {
  titulo: string;
  confirmacion: string;
  /** La ruta de la API, ya con su identificador. */
  ruta: string;
  onBorrado: () => void;
  onCerrar: () => void;
}) {
  const { t } = useTranslation();
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const borrar = async () => {
    setOcupado(true);
    setFallo(null);
    try {
      const res = await apiFetch(ruta, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) {
        setFallo(serverMessage(body, t, t("common.deleteError")));
        return;
      }
      onBorrado();
      onCerrar();
    } catch {
      setFallo(t("common.deleteError"));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{confirmacion}</DialogDescription>
        </DialogHeader>
        {fallo && <p className="text-sm text-status-error-fg">{fallo}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar}>
            {fallo ? t("common.close") : t("common.cancel")}
          </Button>
          {!fallo && (
            <Button variant="destructive" onClick={borrar} disabled={ocupado}>
              {ocupado ? t("common.saving") : t("common.delete")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
