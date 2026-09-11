import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { FileSignature, CreditCard, Image as ImageIcon, KeyRound, Search, Check } from "lucide-react";
import { AccessCode } from "@/components/AccessCode";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/mockData";
import { useApi, apiFetch, readJson } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface ClientOption {
  id: string;
  name: string;
  /** Su código del portal, para poder reenviárselo sin invalidar el suyo. */
  accessCode: string | null;
}

interface ClientPortalData {
  client: { id: string; name: string };
  project: { id: string; name: string; progressPercent: number } | null;
  estimate: { id: string; status: string; total: number } | null;
  pendingInvoice: { id: string; number: string | null; type: string; amount: number; status: string } | null;
  visiblePhotos: { id: string }[];
}

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `oklch(0.74 0.07 ${hash % 360})`;
}

export default function ClientPortal() {
  const { t } = useTranslation();
  const { data: clients, reload: recargarClientes } = useApi<ClientOption[]>("/api/clients");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const clientId = selectedClientId ?? clients?.[0]?.id ?? null;
  const clientElegido = clients?.find((c) => c.id === clientId) ?? null;

  const { data, loading, error } = useApi<ClientPortalData>(clientId ? `/api/client-portal/${clientId}` : null);
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);
  const [issuing, setIssuing] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  // Sin acentos ni mayúsculas, igual que en fichajes: quien busca escribe
  // "tremblay" con el teclado que tenga a mano.
  const sinAcentos = (v: string) =>
    v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const aguja = sinAcentos(busqueda.trim());
  const visibles = (clients ?? []).filter((c) => !aguja || sinAcentos(c.name).includes(aguja));

  // The business hands this code to the client however they already talk —
  // it's what replaces the old email + password-reset round trip.
  // Se genera para el cliente de esa fila, no para "el elegido": con la lista
  // entera a la vista, pulsar en una fila y que le cambie el código a otro
  // sería el peor fallo posible aquí.
  const generateCode = async (id: string, nombre: string) => {
    setIssuing(id);
    try {
      const res = await apiFetch(`/api/clients/${id}/access-token`, { method: "POST" });
      const body = await readJson(res);
      if (res.ok) {
        setNewToken({ name: nombre, token: body.token });
        recargarClientes();
      }
    } finally {
      setIssuing(null);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={t("clientPortal.title")}
        description={t("clientPortal.previewDescription")}
      />

      {/* Antes esto era un desplegable llamado "Previsualizar como" que sólo
          enseñaba un cliente a la vez. Con veinte, responder "¿a quién le falta
          código?" obligaba a abrirlos de uno en uno. Ahora están todos a la
          vista, con su estado, y elegir uno es lo que cambia la vista previa
          de abajo. */}
      <Card className="p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">{t("clientPortal.accessTitle")}</p>

        {(clients?.length ?? 0) > 1 && (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t("clientPortal.searchPlaceholder")}
              className="pl-9"
              aria-label={t("clientPortal.searchPlaceholder")}
            />
          </div>
        )}

        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {visibles.map((c) => {
            const elegido = c.id === clientId;
            return (
              // La fila entera selecciona. No es un <button> porque dentro hay
              // otro —generar el código— y un botón dentro de otro no es HTML
              // válido: el navegador decide por su cuenta cuál se pulsa.
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                aria-pressed={elegido}
                onClick={() => setSelectedClientId(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedClientId(c.id);
                  }
                }}
                className={cn(
                  "-mx-4 px-4 py-3 cursor-pointer transition-colors space-y-2",
                  elegido ? "bg-secondary" : "hover:bg-secondary/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0",
                      elegido ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm truncate", elegido ? "font-medium text-foreground" : "text-foreground")}>
                      {c.name}
                    </p>
                    {!c.accessCode && (
                      <p className="text-xs text-muted-foreground">{t("technicians.noAccessCode")}</p>
                    )}
                  </div>
                  {elegido && <Check size={16} className="text-primary flex-shrink-0" />}
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap pl-11">
                  {c.accessCode ? <AccessCode code={c.accessCode} /> : <span />}
                  {/* Sólo este botón se aparta de la fila: generar un código no
                      debe cambiar de quién es la vista previa. Todo lo demás,
                      incluido el hueco de al lado, sigue seleccionando — si no,
                      hay zonas de la fila que parecen pulsables y no lo son. */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 flex-shrink-0 ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      generateCode(c.id, c.name);
                    }}
                    disabled={issuing === c.id}
                  >
                    <KeyRound size={13} />
                    {c.accessCode ? t("technicians.regenerateCode") : t("clientPortal.generateAccessCode")}
                  </Button>
                </div>
              </div>
            );
          })}
          {visibles.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("clientPortal.noMatches", { query: busqueda.trim() })}
            </p>
          )}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t("clientPortal.previewOf", { name: clientElegido?.name ?? "—" })}
      </p>

      <Dialog open={!!newToken} onOpenChange={(open) => !open && setNewToken(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("clientPortal.accessCodeFor", { name: newToken?.name })}</DialogTitle>
            <DialogDescription>{t("clientPortal.accessCodeNote", { name: newToken?.name })}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-secondary p-4 text-center font-mono text-lg tracking-wider">
            {newToken?.token}
          </div>
          <DialogFooter>
            <Button onClick={() => setNewToken(null)}>{t("common.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <p className="text-xs text-muted-foreground">{t("clientPortal.title")} · {t("clientPortal.readOnly")}</p>
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
                  <Button className="gap-2 flex-1" disabled title={t("clientPortal.previewDisabled")}>
                    <FileSignature size={16} /> {t("clientPortal.signEstimate")}
                  </Button>
                  <Button variant="outline" className="gap-2 flex-1" disabled title={t("clientPortal.previewDisabled")}>
                    <CreditCard size={16} />
                    {data.pendingInvoice
                      ? t("clientPortal.payInvoice", { type: t(`invoicing.typeLong.${data.pendingInvoice.type}`).toLowerCase(), amount: formatCurrency(data.pendingInvoice.amount) })
                      : t("clientPortal.payDeposit")}
                  </Button>
                </div>
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
                    {t("clientPortal.noPhotosAdmin")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {t("clientPortal.previewNote")}
      </p>
    </div>
  );
}
