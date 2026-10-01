import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch, readJson, serverMessage } from "@/lib/api";
import { paisDe } from "@shared/paises";
import { faltaParaFatturaPA, type DatosFiscalesCliente } from "@shared/fatturaPA";

/**
 * Los datos que pide la factura electrónica italiana de quien la recibe.
 *
 * Sin ellos no hay XML que el SDI acepte: una empresa necesita su Partita IVA
 * y su código de destinatario (o su PEC); un particular, su codice fiscale; y
 * los dos, la dirección por partes. Se piden aquí, en la ficha del cliente, y
 * no al emitir la factura, porque se escriben una vez y valen para todas.
 *
 * Arriba se dice si ya está completo, que es la única pregunta que se hace
 * quien abre esto con prisa.
 */
export function DatosFiscalesDelCliente({
  clientId,
  datos,
  onGuardado,
}: {
  clientId: string;
  datos: DatosFiscalesCliente;
  onGuardado: () => void;
}) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(datos);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const faltan = faltaParaFatturaPA(datos);

  const abrir = () => {
    setBorrador(datos);
    setError(null);
    setAbierto(true);
  };

  const guardar = async () => {
    setOcupado(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partitaIva: borrador.partitaIva ?? "",
          codiceFiscale: borrador.codiceFiscale ?? "",
          codiceDestinatario: borrador.codiceDestinatario ?? "",
          pec: borrador.pec ?? "",
          addressLine: borrador.addressLine ?? "",
          postalCode: borrador.postalCode ?? "",
          city: borrador.city ?? "",
          region: borrador.region ?? "",
        }),
      });
      const cuerpo = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(cuerpo, t, t("common.genericError")));
      setAbierto(false);
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setOcupado(false);
    }
  };

  const campo = (clave: keyof DatosFiscalesCliente, etiqueta: string, ayuda?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`df-${clave}`}>{etiqueta}</Label>
      <Input
        id={`df-${clave}`}
        value={borrador[clave] ?? ""}
        onChange={(e) => setBorrador({ ...borrador, [clave]: e.target.value })}
      />
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground text-sm">{t("clientFiscal.title")}</h3>
        <Button variant="ghost" size="sm" className="gap-1.5 -mt-1 -mr-2" onClick={abrir}>
          <Pencil size={13} /> {t("common.edit")}
        </Button>
      </div>

      {faltan.length === 0 ? (
        <p className="text-xs text-status-success-fg inline-flex items-center gap-1.5">
          <CheckCircle2 size={13} className="shrink-0" /> {t("clientFiscal.complete")}
        </p>
      ) : (
        <div className="text-xs text-status-warning-fg space-y-1">
          <p className="inline-flex items-center gap-1.5">
            <AlertTriangle size={13} className="shrink-0" /> {t("clientFiscal.incomplete")}
          </p>
          <p className="text-muted-foreground">{faltan.map((f) => t(`clientFiscal.missing.${f}`)).join(" · ")}</p>
        </div>
      )}

      <dl className="space-y-1.5 text-sm">
        {datos.partitaIva && (
          <div>
            <dt className="text-xs text-muted-foreground">{t("settings.partitaIva")}</dt>
            <dd className="text-foreground font-mono break-all">{datos.partitaIva}</dd>
          </div>
        )}
        {datos.codiceFiscale && (
          <div>
            <dt className="text-xs text-muted-foreground">{t("settings.codiceFiscale")}</dt>
            <dd className="text-foreground font-mono break-all">{datos.codiceFiscale}</dd>
          </div>
        )}
        {(datos.codiceDestinatario || datos.pec) && (
          <div>
            <dt className="text-xs text-muted-foreground">{t("clientFiscal.delivery")}</dt>
            <dd className="text-foreground break-all">{[datos.codiceDestinatario, datos.pec].filter(Boolean).join(" · ")}</dd>
          </div>
        )}
        {(datos.addressLine || datos.city) && (
          <div>
            <dt className="text-xs text-muted-foreground">{t("common.address")}</dt>
            <dd className="text-foreground break-words">
              {[datos.addressLine, [datos.postalCode, datos.city, datos.region && `(${datos.region})`].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(", ")}
            </dd>
          </div>
        )}
      </dl>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("clientFiscal.title")}</DialogTitle>
            <DialogDescription>{t("clientFiscal.hint")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campo("partitaIva", t("settings.partitaIva"), t("clientFiscal.partitaIvaHint"))}
            {campo("codiceFiscale", t("settings.codiceFiscale"), t("clientFiscal.codiceFiscaleHint"))}
            {campo("codiceDestinatario", t("clientFiscal.codiceDestinatario"), t("clientFiscal.codiceDestinatarioHint"))}
            {campo("pec", t("settings.pec"))}
            <div className="sm:col-span-2">{campo("addressLine", t("settings.indirizzo"))}</div>
            {campo("postalCode", t("settings.cap"))}
            {campo("city", t("settings.comune"))}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("countries.region.provinciaItalia")}</Label>
              <Select value={borrador.region ?? ""} onValueChange={(v) => setBorrador({ ...borrador, region: v })}>
                <SelectTrigger className="min-w-0">
                  <SelectValue placeholder={t("payments.selectProvince")} />
                </SelectTrigger>
                <SelectContent>
                  {paisDe("IT").regiones.map((r) => (
                    <SelectItem key={r.codigo} value={r.codigo}>{`${r.nombre} (${r.codigo})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button onClick={() => void guardar()} disabled={ocupado}>
            {ocupado ? <Spinner className="size-4" /> : t("common.save")}
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
