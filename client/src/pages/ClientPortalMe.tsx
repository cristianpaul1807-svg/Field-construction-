import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSignature, CreditCard, Image as ImageIcon, LogOut, LayoutDashboard, MessageCircle } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useApi, apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ClientChat } from "@/components/ClientChat";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { clearClientSession } from "@/lib/clientSession";

interface ClientPortalData {
  client: { id: string; name: string };
  project: { id: string; name: string; progressPercent: number } | null;
  estimate: { id: string; status: string; total: number } | null;
  pendingInvoice: { id: string; type: string; amount: number; status: string } | null;
  visiblePhotos: { id: string }[];
}

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `oklch(0.74 0.07 ${hash % 360})`;
}

export default function ClientPortalMe() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  // The portal serves two kinds of session (access code and Supabase login),
  // so signing out has to clear whichever one got them in.
  const leave = async () => {
    clearClientSession();
    await signOut();
    window.location.href = "/cliente/acceso";
  };
  const { data, loading, error } = useApi<ClientPortalData>("/api/client-portal/me");
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const pay = async (invoiceId: string) => {
    setPayingInvoiceId(invoiceId);
    setPayError(null);
    try {
      const res = await apiFetch(`/api/client/invoices/${invoiceId}/checkout`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || t("clientPortal.payError"));
      window.location.href = body.url;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : t("clientPortal.payError"));
      setPayingInvoiceId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold text-sm">
            R
          </div>
          <span className="font-semibold text-foreground text-sm">{t("clientPortal.title")}</span>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <Button variant="ghost" size="sm" className="gap-2" onClick={leave}>
            <LogOut size={14} /> {t("common.logout")}
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6">
        <Tabs defaultValue="resumen">
          <TabsList className="w-full">
            <TabsTrigger value="resumen" className="flex-1 gap-1.5">
              <LayoutDashboard size={14} /> {t("clientPortal.summary")}
            </TabsTrigger>
            <TabsTrigger value="mensajes" className="flex-1 gap-1.5">
              <MessageCircle size={14} /> {t("clientPortal.messages")}
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
              <p className="text-xs text-muted-foreground">{t("clientPortal.readOnly")}</p>
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
                      <p className="text-xl font-semibold text-foreground mt-1">{formatCurrency(data.estimate.total)}</p>
                    </div>
                    <StatusBadge tone="info">{data.estimate.status}</StatusBadge>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <Button className="gap-2 flex-1">
                      <FileSignature size={16} /> {t("clientPortal.signEstimate")}
                    </Button>
                    {data.pendingInvoice && (
                      <Button
                        variant="outline"
                        className="gap-2 flex-1"
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
                  {payError && <p className="text-sm text-status-error-fg mt-2">{payError}</p>}
                </Card>
              )}

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon size={16} className="text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">{t("clientPortal.sharedPhotos")}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {data.visiblePhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="aspect-square rounded-lg border border-border"
                      style={{ background: colorForId(photo.id) }}
                    />
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
    </div>
  );
}
