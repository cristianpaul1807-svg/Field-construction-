import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch, readJson, serverMessage } from "@/lib/api";
import type { FaltaDelCliente, FaltaDelNegocio } from "@shared/fatturaPA";

interface Faltan {
  negocio: FaltaDelNegocio[];
  cliente: FaltaDelCliente[];
}

/**
 * Descargar la factura electrónica italiana (el XML que va al SDI).
 *
 * Si falta un dato, el servidor no genera nada y dice qué falta y de quién.
 * Aquí se enseña esa lista con el enlace a donde se rellena —la ficha del
 * cliente o los datos de la empresa—, porque «faltan datos» sin decir cuáles
 * es mandar a alguien a buscar por todo el panel.
 */
export function BotonFatturaPA({ ruta }: { ruta: string }) {
  const { t } = useTranslation();
  const [ocupado, setOcupado] = useState(false);
  const [faltan, setFaltan] = useState<(Faltan & { clientId: string | null }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const descargar = async () => {
    setOcupado(true);
    setError(null);
    try {
      const res = await apiFetch(ruta);
      if (!res.ok) {
        const cuerpo = await readJson<{ code?: string; faltan?: Faltan; clientId?: string | null }>(res);
        if (cuerpo?.code === "fatturapa_datos_incompletos" && cuerpo.faltan) {
          setFaltan({ ...cuerpo.faltan, clientId: cuerpo.clientId ?? null });
          return;
        }
        throw new Error(serverMessage(cuerpo, t, t("common.genericError")));
      }
      const nombre = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "fattura.xml";
      const url = URL.createObjectURL(await res.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 min-h-11 lg:min-h-0"
        onClick={() => void descargar()}
        disabled={ocupado}
        title={t("fatturaPA.howToSend")}
      >
        {ocupado ? <Spinner className="size-3.5" /> : <FileCode2 size={13} strokeWidth={1.75} />}
        {t("fatturaPA.download")}
      </Button>
      {error && <p className="text-xs text-status-error-fg basis-full">{error}</p>}

      <Dialog open={faltan !== null} onOpenChange={(v) => !v && setFaltan(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("fatturaPA.missingTitle")}</DialogTitle>
            <DialogDescription>{t("fatturaPA.howToSend")}</DialogDescription>
          </DialogHeader>
          {faltan && faltan.negocio.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{t("fatturaPA.missingBusiness")}</p>
              <p className="text-sm text-muted-foreground">{faltan.negocio.map((f) => t(`fatturaPA.negocio.${f}`)).join(" · ")}</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/settings/company">{t("fatturaPA.goBusiness")}</Link>
              </Button>
            </div>
          )}
          {faltan && faltan.cliente.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{t("fatturaPA.missingClient")}</p>
              <p className="text-sm text-muted-foreground">{faltan.cliente.map((f) => t(`clientFiscal.missing.${f}`)).join(" · ")}</p>
              {faltan.clientId && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/crm/${faltan.clientId}`}>{t("fatturaPA.goClient")}</Link>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
