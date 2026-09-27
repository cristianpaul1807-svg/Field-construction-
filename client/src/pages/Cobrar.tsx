import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import QRCode from "qrcode";
import { Check, CheckCircle2, Copy, QrCode, Share2, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/mockData";
import { useApi, apiFetch, readJson, serverMessage } from "@/lib/api";

interface Factura {
  id: string;
  number: string | null;
  amount: number;
  status: "pendiente" | "pagado" | "vencido" | "cancelado";
  clientName: string | null;
  projectName: string | null;
}

interface EstadoStripe {
  connected: boolean;
  chargesEnabled: boolean;
}

/** Cada cuánto se mira si ya pagó. Lo bastante corto para que el cliente,
 *  delante, vea el «pagado» sin quedarse esperando; lo bastante largo para no
 *  estar pidiendo la lista entera sin parar. */
const MIRAR_CADA_MS = 4000;

/**
 * Cobrar a quien está delante.
 *
 * El cliente está en la oficina, o en la obra, y quiere pagar ya. El enlace de
 * pago existía, pero escondido en la lista de facturas y pensado para
 * mandarlo: había que copiarlo, pegarlo en un chat y esperar a que el otro lo
 * abriera. Aquí sale como un QR grande que escanea con su móvil, y la
 * pantalla dice «pagado» sola cuando Stripe lo confirma — que es lo que el
 * contratista necesita ver antes de dejarle ir.
 *
 * El dinero va a la cuenta de Stripe del propio negocio y se apunta en la
 * factura por el mismo aviso firmado de siempre: esta pantalla no marca nada
 * como pagado, sólo lo enseña.
 */
export default function Cobrar() {
  const { t, i18n } = useTranslation();
  const { data: stripe, loading: cargandoStripe } = useApi<EstadoStripe>("/api/stripe/connect/status");
  const { data: facturas, loading: cargandoFacturas } = useApi<Factura[]>("/api/invoices");

  const [elegida, setElegida] = useState("");
  const [enlace, setEnlace] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pagada, setPagada] = useState(false);

  const pendientes = (facturas ?? []).filter(
    (f) => (f.status === "pendiente" || f.status === "vencido") && Number(f.amount) > 0
  );
  const factura = pendientes.find((f) => f.id === elegida) ?? null;

  const nombreDe = (f: Factura) =>
    [f.number, f.clientName ?? t("cobrar.sinCliente"), formatCurrency(Number(f.amount))].filter(Boolean).join(" · ");

  const empezarDeNuevo = () => {
    setElegida("");
    setEnlace(null);
    setQr(null);
    setPagada(false);
    setFallo(null);
  };

  const generar = async () => {
    if (!elegida) return;
    setGenerando(true);
    setFallo(null);
    try {
      const res = await apiFetch(
        `/api/invoices/${elegida}/checkout-link?lang=${i18n.language.slice(0, 2)}&destino=oficina`,
        { method: "POST" }
      );
      const body = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(body, t, t("cobrar.falloAlGenerar")));
      const url = String(body.url);
      setEnlace(url);
      // Con margen y a buen tamaño: lo escanea un móvil a un brazo de
      // distancia, a veces con la pantalla del contratista a media luz.
      setQr(await QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "M" }));
    } catch (err) {
      setFallo(err instanceof Error ? err.message : t("cobrar.falloAlGenerar"));
    } finally {
      setGenerando(false);
    }
  };

  // Mientras el QR está en pantalla, mirar si ya entró el pago. Se para al
  // verlo, o al salir, para no seguir preguntando por una factura cerrada.
  useEffect(() => {
    if (!enlace || !elegida || pagada) return;
    const reloj = window.setInterval(async () => {
      try {
        const res = await apiFetch("/api/invoices");
        if (!res.ok) return;
        const lista = (await readJson(res)) as Factura[] | null;
        if (lista?.find((f) => f.id === elegida)?.status === "pagado") setPagada(true);
      } catch {
        // Un fallo de red al mirar no es un fallo del cobro: se vuelve a
        // mirar en el siguiente turno.
      }
    }, MIRAR_CADA_MS);
    return () => window.clearInterval(reloj);
  }, [enlace, elegida, pagada]);

  const copiar = async () => {
    if (!enlace) return;
    await navigator.clipboard.writeText(enlace);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const compartir = async () => {
    if (!enlace || !factura) return;
    try {
      await navigator.share({ title: t("cobrar.compartirTitulo"), text: nombreDe(factura), url: enlace });
    } catch {
      // Cerrar la hoja de compartir sin elegir nada también «falla»; no es
      // algo que haya que contarle a nadie.
    }
  };

  const puedeCompartir = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const cargando = cargandoStripe || cargandoFacturas;

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title={t("cobrar.titulo")} description={t("cobrar.descripcion")} />

      {cargando && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" /> {t("common.loading")}
        </div>
      )}

      {/* Sin Stripe activo no hay pasarela a la que mandar a nadie. Un QR
          que lleva a un error es peor que no tenerlo, así que se dice qué
          falta y dónde se arregla. */}
      {!cargando && !stripe?.chargesEnabled && (
        <Card className="p-6 space-y-3">
          <p className="text-sm font-medium text-foreground">{t("cobrar.sinStripeTitulo")}</p>
          <p className="text-sm text-muted-foreground">{t("cobrar.sinStripeTexto")}</p>
          <Button asChild className="gap-2">
            <Link href="/settings/payments">
              {t("cobrar.irAConfigurar")} <ArrowRight size={16} />
            </Link>
          </Button>
        </Card>
      )}

      {!cargando && stripe?.chargesEnabled && !enlace && (
        <Card className="p-6 space-y-4">
          {pendientes.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("cobrar.sinPendientes")}</p>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/invoicing">
                  {t("cobrar.irAFacturas")} <ArrowRight size={16} />
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>{t("cobrar.queFactura")}</Label>
                <Select value={elegida} onValueChange={setElegida}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("cobrar.eligeFactura")} />
                  </SelectTrigger>
                  <SelectContent>
                    {pendientes.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {nombreDe(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {fallo && <p className="text-sm text-status-error-fg">{fallo}</p>}
              <Button className="w-full gap-2" onClick={generar} disabled={!elegida || generando}>
                {generando ? <Spinner className="size-4" /> : <QrCode size={16} />}
                {t("cobrar.generar")}
              </Button>
              {/* Un depósito o un extra que aún no tiene factura: la factura va
                  primero, porque es la que lleva la TPS y la TVQ y la que queda
                  en los libros. Cobrar un importe suelto lo saltaría. */}
              <p className="text-xs text-muted-foreground">
                {t("cobrar.sinFacturaTodavia")}{" "}
                <Link href="/invoicing" className="text-primary hover:underline">
                  {t("cobrar.crearFactura")}
                </Link>
              </p>
            </>
          )}
        </Card>
      )}

      {enlace && factura && (
        <Card className="p-6 space-y-5 text-center">
          {pagada ? (
            <div className="space-y-3 py-6">
              <CheckCircle2 className="mx-auto size-16 text-status-success-fg" strokeWidth={1.5} />
              <p className="text-lg font-semibold text-foreground">{t("cobrar.pagada")}</p>
              <p className="text-sm text-muted-foreground">{nombreDe(factura)}</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-3xl font-semibold text-foreground">{formatCurrency(Number(factura.amount))}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {[factura.number, factura.clientName, factura.projectName].filter(Boolean).join(" · ")}
                </p>
              </div>
              {qr && (
                <img
                  src={qr}
                  alt={t("cobrar.qrAlt")}
                  className="mx-auto w-full max-w-[320px] aspect-square rounded-lg border border-border bg-white"
                />
              )}
              <p className="text-sm text-muted-foreground">{t("cobrar.escaneaConElMovil")}</p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Spinner className="size-3" /> {t("cobrar.esperandoPago")}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={copiar}>
                  {copiado ? <Check size={16} /> : <Copy size={16} />}
                  {copiado ? t("cobrar.copiado") : t("cobrar.copiarEnlace")}
                </Button>
                {puedeCompartir && (
                  <Button variant="outline" className="flex-1 gap-2" onClick={compartir}>
                    <Share2 size={16} /> {t("cobrar.compartir")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("cobrar.caduca")}</p>
            </>
          )}
          <Button variant="ghost" className="w-full" onClick={empezarDeNuevo}>
            {t("cobrar.otroCobro")}
          </Button>
        </Card>
      )}
    </div>
  );
}
