import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSignature, CreditCard, CheckCircle2, Download, FilePlus2, Image as ImageIcon, LogOut, LayoutDashboard, MessageCircle } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useApi, apiFetch, downloadFile, readJson, serverMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ClientChat } from "@/components/ClientChat";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MarcaDelNegocio } from "@/components/MarcaDelNegocio";
import { clearClientSession } from "@/lib/clientSession";
import { LifecyclePanel, type Lifecycle } from "@/components/LifecyclePanel";
import { SignEstimateDialog } from "@/components/SignEstimateDialog";
import { PaymentScheduleCard, type PaymentMilestone } from "@/components/PaymentScheduleCard";

interface ClientPortalData {
  client: { id: string; name: string };
  project: {
    id: string;
    name: string;
    progressPercent: number;
    status: string;
    lifecycle: Lifecycle | null;
    paymentSchedule: PaymentMilestone[];
  } | null;
  estimate: {
    id: string;
    status: string;
    /** Antes de impuestos, que es lo que se guarda y sobre lo que se factura. */
    total: number;
    taxAmount?: number;
    totalWithTax?: number;
    /** Cada impuesto por su cuenta. En Quebec son dos y se declaran aparte. */
    taxBreakdown?: { province?: string; hst?: number; gst?: number; pst?: number };
    signature: { name: string; signedAt: string; total: number } | null;
  } | null;
  pendingInvoice: { id: string; number: string | null; type: string; amount: number; status: string } | null;
  /** De quién es el portal. Nulo sólo si al cliente le falta el negocio. */
  business: { name: string; logoUrl: string | null } | null;
  visiblePhotos: { id: string }[];
}

interface ClientChangeOrder {
  id: string;
  projectName: string | null;
  title: string;
  description: string | null;
  amount: number;
  status: "enviado" | "aprobado" | "rechazado";
  createdAt: string;
}

/**
 * La foto, de verdad.
 *
 * Aquí se pintaba un cuadrado de color por foto —colorForId— y nunca la
 * imagen: el contratista marcaba fotos como visibles para su cliente y su
 * cliente veía rectángulos. Viven en un bucket privado, así que cada una pide
 * su propia URL firmada y de vida corta.
 *
 * El color se queda como fondo mientras carga, que es mejor que un hueco
 * blanco; si no se puede mostrar se dice, en vez de dejar el cuadrado ahí
 * pareciendo una foto que nunca llega.
 */
function PhotoTile({ id }: { id: string }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    apiFetch(`/api/client-portal/photos/${id}/url`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((b) => { if (!cancelado && b?.url) setUrl(b.url); else if (!cancelado) setFallo(true); })
      .catch(() => { if (!cancelado) setFallo(true); });
    return () => { cancelado = true; };
  }, [id]);

  if (url) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setFallo(true)}
        className="aspect-square w-full object-cover rounded-lg border border-border"
      />
    );
  }

  return (
    <div
      className="aspect-square rounded-lg border border-border flex items-center justify-center p-2"
      style={fallo ? undefined : { background: colorForId(id) }}
    >
      {fallo && <span className="text-[10px] text-muted-foreground text-center leading-tight">{t("clientPortal.photoUnavailable")}</span>}
    </div>
  );
}

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `oklch(0.74 0.07 ${hash % 360})`;
}

/**
 * Las líneas de impuesto del desglose que manda el servidor.
 *
 * Los nombres son los que el cliente ve en cualquier otra factura de su
 * provincia: en Quebec, TPS y TVQ. El importe llega ya calculado y redondeado
 * — aquí no se recalcula nada, que es como se acaba enseñando una cifra
 * distinta de la del papel.
 */
function lineasDeImpuesto(tb: { province?: string; hst?: number; gst?: number; pst?: number } | undefined) {
  const lineas: { label: string; amount: number }[] = [];
  if (!tb) return lineas;
  if (tb.hst !== undefined) lineas.push({ label: "TVH/HST", amount: tb.hst });
  if (tb.gst !== undefined) lineas.push({ label: "TPS/GST", amount: tb.gst });
  if (tb.pst !== undefined) {
    lineas.push({ label: tb.province === "QC" ? "TVQ/QST" : "PST", amount: tb.pst });
  }
  return lineas;
}

export default function ClientPortalMe() {
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();

  // The portal serves two kinds of session (access code and Supabase login),
  // so signing out has to clear whichever one got them in.
  const leave = async () => {
    clearClientSession();
    await signOut();
    window.location.href = "/cliente/acceso";
  };
  const { data, loading, error, reload } = useApi<ClientPortalData>("/api/client-portal/me");
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const {
    data: changeOrders,
    reload: reloadChangeOrders,
  } = useApi<ClientChangeOrder[]>("/api/client-portal/change-orders");

  const decideChangeOrder = async (changeOrderId: string, decision: "aprobado" | "rechazado") => {
    setDecidingId(changeOrderId);
    setPayError(null);
    try {
      const res = await apiFetch(`/api/client-portal/change-orders/${changeOrderId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error(serverMessage(await res.json().catch(() => null), t, t("common.genericError")));
      reloadChangeOrders();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setDecidingId(null);
    }
  };

  const downloadEstimate = async (estimateId: string) => {
    setDownloading(true);
    setPayError(null);
    try {
      await downloadFile(
        `/api/client-portal/estimates/${estimateId}/pdf?lang=${i18n.language.slice(0, 2)}`,
        `${t("budgets.estimateFilePrefix")}-${estimateId.slice(0, 8).toUpperCase()}.pdf`
      );
    } catch (err) {
      setPayError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setDownloading(false);
    }
  };

  // The customer saying the work is finished. It does not close the job —
  // the final invoice still has to be paid — but it puts their sign-off on
  // the record with a date, which is the half of the argument that usually
  // has no evidence behind it.
  const confirmWork = async (projectId: string) => {
    setConfirming(true);
    setPayError(null);
    try {
      const res = await apiFetch(`/api/client-portal/projects/${projectId}/confirm`, { method: "POST" });
      if (!res.ok) throw new Error(serverMessage(await readJson(res), t, t("portal.progress.confirmError")));
      reload();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : t("portal.progress.confirmError"));
    } finally {
      setConfirming(false);
    }
  };

  const pay = async (invoiceId: string) => {
    setPayingInvoiceId(invoiceId);
    setPayError(null);
    try {
      const res = await apiFetch(`/api/client/invoices/${invoiceId}/checkout`, { method: "POST" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(body, t, t("clientPortal.payError")));
      window.location.href = body.url;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : t("clientPortal.payError"));
      setPayingInvoiceId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="border-b border-border bg-card px-4 sm:px-8 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
        {/* Arriba va el contratista, no nosotros: el cliente entra aquí a ver
            su obra, y la "R" que había —del negocio de demostración— no era de
            nadie. Sin logotipo se enseña su inicial, nunca nuestra marca. */}
        <div className="flex items-center gap-2.5 min-w-0">
          <MarcaDelNegocio logoUrl={data?.business?.logoUrl} name={data?.business?.name} size={32} recurso="inicial" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight truncate">
              {data?.business?.name ?? t("clientPortal.title")}
            </p>
            <p className="text-xs text-muted-foreground leading-tight">{t("clientPortal.title")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <Button variant="ghost" size="sm" className="gap-2 min-h-11" onClick={leave}>
            <LogOut size={14} /> {t("common.logout")}
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6">
        <Tabs defaultValue="resumen">
          {/* El portal se abre en el móvil, igual que el del trabajador, y por
              el mismo motivo las pestañas necesitan alto de dedo. Aquí además
              es el cliente quien paga: una pulsación que falla en esta pantalla
              cuesta más que en ninguna otra. */}
          <TabsList className="w-full h-auto">
            <TabsTrigger value="resumen" className="flex-1 gap-1.5 min-h-11">
              <LayoutDashboard size={16} /> {t("clientPortal.summary")}
            </TabsTrigger>
            <TabsTrigger value="mensajes" className="flex-1 gap-1.5 min-h-11">
              <MessageCircle size={16} /> {t("clientPortal.messages")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="mt-4 space-y-6">
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

            {!loading && !error && data && (
              <Card className="p-0 overflow-hidden border-2">
            <div className="bg-secondary px-6 py-4 border-b border-border">
              {/* Aquí ponía "Solo lectura", y debajo hay botones para confirmar
                  que la obra está terminada, aprobar avenants y pagar. El
                  rótulo es cierto en la vista previa del panel, no aquí: a un
                  cliente que acaba de pulsar "confirmo" le hace dudar de si su
                  clic ha servido de algo, y de ese clic cuelga la factura
                  final. */}
              <p className="text-xs text-muted-foreground">{t("clientPortal.yourProject")}</p>
              <h2 className="text-lg font-semibold text-foreground mt-0.5">{t("clientPortal.hello", { name: data.client.name.split(" ")[0] })}</h2>
            </div>

            <div className="p-6 space-y-6">
              {data.project && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-foreground">{data.project.name}</p>
                    <span className="text-sm text-muted-foreground">{data.project.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${data.project.progressPercent}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{t("clientPortal.projectProgress")}</p>

                  {data.project.lifecycle && (
                    <div className="mt-4">
                      <LifecyclePanel lifecycle={data.project.lifecycle} showHistory={false} />
                    </div>
                  )}

                  {/* No billing button here on purpose: the customer reads the
                      schedule, the contractor is the one who issues. */}
                  {data.project.paymentSchedule?.length > 0 && (
                    <div className="mt-4">
                      <PaymentScheduleCard milestones={data.project.paymentSchedule} />
                    </div>
                  )}

                  {data.project.status === "en_progreso" && (
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        className="w-full gap-2 min-h-11"
                        onClick={() => confirmWork(data.project!.id)}
                        disabled={confirming}
                      >
                        {confirming ? <Spinner className="size-4" /> : <CheckCircle2 size={16} />}
                        {t("portal.progress.confirm")}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">{t("portal.progress.confirmHint")}</p>
                    </div>
                  )}
                  {data.project.status === "confirmado" && (
                    <p className="text-xs text-muted-foreground mt-4">{t("portal.progress.confirmed")}</p>
                  )}
                </div>
              )}

              {!data.project && (
                <p className="text-sm text-muted-foreground">{t("clientPortal.noActiveProject")}</p>
              )}

              {data.estimate && (
                <Card className="p-4 bg-secondary border-none">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("clientPortal.estimateNumber", { id: data.estimate.id.slice(0, 8).toUpperCase() })}</p>
                      {/* El cliente veía el total sin impuestos, y el PDF que
                          se descarga desde el botón de abajo sí los lleva: dos
                          cifras distintas para el mismo presupuesto, en la
                          pantalla donde decide si firma. Manda la de arriba,
                          que es la que va a pagar. */}
                      <p className="text-xl font-semibold text-foreground mt-1">
                        {formatCurrency(data.estimate.totalWithTax ?? data.estimate.total)}
                      </p>
                      {/* El desglose y no una suma: el cliente de Quebec ve
                          TPS y TVQ separadas en cualquier factura que reciba, y
                          una sola línea de "impuestos" le hace dudar de la
                          cifra justo antes de firmarla. Es lo mismo que ya sale
                          en el PDF. */}
                      {data.estimate.taxAmount ? (
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <div className="flex justify-between gap-4">
                            <span>{t("budgets.beforeTax")}</span>
                            <span>{formatCurrency(data.estimate.total)}</span>
                          </div>
                          {lineasDeImpuesto(data.estimate.taxBreakdown).map((linea) => (
                            <div key={linea.label} className="flex justify-between gap-4">
                              <span>{linea.label}</span>
                              <span>{formatCurrency(linea.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {/* Se guarda "aceptado" porque ese es el dato, pero esta es
                        la pantalla del cliente que paga: el slug en castellano
                        salía crudo junto al importe en un portal en francés. */}
                    <StatusBadge tone="info">{t(`budgets.estimateStatus.${data.estimate.status}`)}</StatusBadge>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    {data.estimate.status !== "aceptado" && (
                      <Button
                        className="gap-2 flex-1 min-h-11"
                        onClick={() => setSigning(true)}
                        disabled={data.estimate.status !== "enviado"}
                        title={data.estimate.status !== "enviado" ? t("clientPortal.notSentYet") : undefined}
                      >
                        <FileSignature size={16} />
                        {t("clientPortal.signEstimate")}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="gap-2 flex-1 min-h-11"
                      onClick={() => downloadEstimate(data.estimate!.id)}
                      disabled={downloading}
                    >
                      {downloading ? <Spinner className="size-4" /> : <Download size={16} />}
                      {t("clientPortal.downloadEstimate")}
                    </Button>
                    {data.pendingInvoice && (
                      <Button
                        variant="outline"
                        className="gap-2 flex-1 min-h-11"
                        onClick={() => pay(data.pendingInvoice!.id)}
                        disabled={payingInvoiceId === data.pendingInvoice.id}
                      >
                        {payingInvoiceId === data.pendingInvoice.id ? (
                          <Spinner className="size-4" />
                        ) : (
                          <CreditCard size={16} />
                        )}
                        {t("clientPortal.payInvoice", { type: t(`invoicing.typeLong.${data.pendingInvoice.type}`).toLowerCase(), amount: formatCurrency(data.pendingInvoice.amount) })}
                      </Button>
                    )}
                  </div>
                  {/* Cuál es la factura que va a pagar. Es el número que lleva
                      el PDF y el que pondrá en la transferencia; sin él, quien
                      tiene dos facturas abiertas no sabe cuál está pagando. */}
                  {data.pendingInvoice?.number && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("clientPortal.invoiceNumber", { number: data.pendingInvoice.number })}
                    </p>
                  )}
                  {data.estimate.signature && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("sign.signedBy", {
                        name: data.estimate.signature.name,
                        date: new Date(data.estimate.signature.signedAt).toLocaleDateString(i18n.language),
                      })}
                    </p>
                  )}
                  {payError && <p className="text-sm text-status-error-fg mt-2">{payError}</p>}
                </Card>
              )}

              {(changeOrders ?? []).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FilePlus2 size={16} className="text-muted-foreground" strokeWidth={1.75} />
                    <p className="text-sm font-medium text-foreground">{t("changeOrders.tab")}</p>
                  </div>
                  <div className="space-y-3">
                    {(changeOrders ?? []).map((co) => (
                      <Card key={co.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{co.title}</p>
                            {co.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{co.description}</p>
                            )}
                            {co.projectName && (
                              <p className="text-xs text-muted-foreground mt-1">{co.projectName}</p>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-foreground flex-shrink-0">
                            {formatCurrency(co.amount)}
                          </span>
                        </div>
                        {co.status === "enviado" ? (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => decideChangeOrder(co.id, "aprobado")}
                              disabled={decidingId === co.id}
                            >
                              {decidingId === co.id ? <Spinner className="size-4" /> : null}
                              {t("changeOrders.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => decideChangeOrder(co.id, "rechazado")}
                              disabled={decidingId === co.id}
                            >
                              {t("changeOrders.reject")}
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <StatusBadge tone={co.status === "aprobado" ? "success" : "neutral"}>
                              {t(`changeOrders.status.${co.status}`)}
                            </StatusBadge>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon size={16} className="text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">{t("clientPortal.sharedPhotos")}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {data.visiblePhotos.map((photo) => (
                    <PhotoTile key={photo.id} id={photo.id} />
                  ))}
                  {data.visiblePhotos.length === 0 && (
                    <p className="col-span-3 text-xs text-muted-foreground">
                      {t("clientPortal.noPhotos")}
                    </p>
                  )}
                </div>
              </div>
            </div>
              </Card>
            )}

            <p className="text-xs text-muted-foreground text-center">
              {t("clientPortal.signatureNote")}
            </p>
          </TabsContent>

          <TabsContent value="mensajes" className="mt-4">
            <ClientChat />
          </TabsContent>
        </Tabs>
      </div>

      {data?.estimate && (
        // "Importe que aceptas" tiene que ser el que va a pagar. Lo que se
        // guarda al firmar sigue siendo el total sin impuestos, que es el valor
        // del contrato y sobre lo que se factura: eso no se toca.
        <SignEstimateDialog
          open={signing}
          onOpenChange={setSigning}
          estimateId={data.estimate.id}
          total={data.estimate.totalWithTax ?? data.estimate.total}
          defaultName={data.client.name}
          onSigned={reload}
        />
      )}
    </div>
  );
}
