import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, KeyRound, Link2, ShieldCheck, Users, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AvisoDeFallo } from "@/components/AvisoDeFallo";
import { apiFetch, readJson, serverMessage, useApi } from "@/lib/api";

interface OAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: string;
  createdAt: string;
  valid: boolean;
}
interface Platform {
  /**
   * Claude y nada más, a propósito.
   *
   * Aquí hubo otras tres plataformas, con su color y su inicial, y el servidor
   * nunca devolvió ninguna: era una promesa pintada en una pantalla de algo
   * que no se puede conectar. Nombrar una plataforma aquí es prometerla, así
   * que la siguiente entra cuando tenga su Client ID registrado y una conexión
   * completada de verdad — no cuando tenga icono.
   */
  id: "claude";
  name: string;
  description: string;
  docsUrl: string;
  configured: boolean;
  clients: OAuthClient[];
  connections: { id: string; status: string; scopes: string[]; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }[];
}
interface MpcConnectionsData {
  mcpUrl: string;
  scope: string;
  platforms: Platform[];
}



function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return <Button type="button" size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t("mcpConex.copiado") : label}</Button>;
}

function Logo() {
  return (
    <div className="size-11 rounded-xl bg-[#f3e5d5] flex items-center justify-center overflow-hidden">
      <img src="/brand/claude-logo.png" alt="Claude" className="size-8 object-contain" />
    </div>
  );
}

export default function SettingsMcpConnections() {
  const { t } = useTranslation();
  const { data, loading, error, detalle, reload } = useApi<MpcConnectionsData>("/api/settings/mcp-connections");
  const [open, setOpen] = useState<string | null>("claude");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const platforms = useMemo(() => data?.platforms ?? [], [data]);

  const revoke = async (id: string) => {
    setRevoking(id);
    setNotice(null);
    try {
      const response = await apiFetch(`/api/settings/mcp-connections/${id}/revoke`, { method: "POST" });
      if (!response.ok) throw new Error(serverMessage(await readJson(response), t, t("mcpConex.noRevoca")));
      setNotice(t("mcpConex.revocada"));
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("mcpConex.noRevoca"));
    } finally {
      setRevoking(null);
    }
  };

  return <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
    <PageHeader title={t("mcpConex.titulo")} description={t("mcpConex.entradilla")} />
    <Card className="p-5 sm:p-6 border-primary/20 bg-primary/[0.03]">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck size={20} /></div>
        <div className="space-y-1">
          <h2 className="font-semibold">{t("mcpConex.seguroTitulo")}</h2>
          <p className="text-sm text-muted-foreground">{t("mcpConex.seguroCuerpo")}</p>
          <p className="text-sm text-muted-foreground">{t("mcpConex.alcance")} <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{data?.scope ?? "mcp:read"}</code></p>
        </div>
      </div>
    </Card>
    {loading && <div className="flex justify-center py-12 text-muted-foreground"><Spinner className="size-5" /></div>}
    {error && <AvisoDeFallo mensaje={t("mcpConex.noCarga")} detalle={detalle} onReintentar={reload} />}
    {notice && <div className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm flex items-center justify-between gap-3"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label={t("common.close")}><X size={15} /></button></div>}
    {!loading && !error && <div className="grid gap-4 md:grid-cols-2">
      {platforms.map((platform) => {
        const isOpen = open === platform.id;
        const validClient = platform.clients.find((client) => client.valid);
        const invalidClients = platform.clients.filter((client) => !client.valid);
        return <Card key={platform.id} className="overflow-hidden">
          <button type="button" className="w-full text-left p-5 flex items-start gap-3 hover:bg-secondary/40 transition-colors" onClick={() => setOpen(isOpen ? null : platform.id)} aria-expanded={isOpen}>
            <Logo />
            <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-semibold">{platform.name}{platform.configured && <span title={t("mcpConex.oauthListoQue")} className="text-[11px] rounded-full bg-status-success-bg text-status-success-fg px-2 py-0.5">{t("mcpConex.oauthListo")}</span>}{platform.connections.some((connection) => connection.status === "active") && <span title={t("mcpConex.conectadoQue")} className="text-[11px] rounded-full bg-status-success-bg text-status-success-fg px-2 py-0.5">{t("mcpConex.conectado")}</span>}</span><span className="block text-sm text-muted-foreground mt-1">{platform.description}</span></span>
            {isOpen ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
          </button>
          {isOpen && <div className="border-t border-border p-5 space-y-5">
            <div className="space-y-3 text-sm">
              <p className="font-medium">{t("mcpConex.comoConectar")}</p>
              <p className="text-xs text-muted-foreground">{t("mcpConex.queSignifica")}</p>
              <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground"><li>{t("mcpConex.paso1", { plataforma: platform.name })}</li><li>{t("mcpConex.paso2")}</li><li>{t("mcpConex.paso3", { plataforma: platform.name })}</li><li>{t("mcpConex.paso4")}</li></ol>
            </div>
            <div className="space-y-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Link2 size={13} /> {t("mcpConex.urlMcp")}</p><div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2"><code className="min-w-0 flex-1 truncate text-xs">{data?.mcpUrl ?? "https://logiciel-construction.com/mcp"}</code><CopyButton value={data?.mcpUrl ?? "https://logiciel-construction.com/mcp"} label={t("mcpConex.copiar")} /></div></div>
            {validClient ? <div className="space-y-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><KeyRound size={13} /> {t("mcpConex.clientId")}</p><div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2"><code className="min-w-0 flex-1 truncate text-xs">{validClient.clientId}</code><CopyButton value={validClient.clientId} label={t("mcpConex.copiar")} /></div><p className="text-xs text-muted-foreground">{t("mcpConex.callback", { url: validClient.redirectUris[0] ?? t("mcpConex.sinCallback") })}</p></div> : <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">{t("mcpConex.sinClientId", { plataforma: platform.name })}</div>}
            {invalidClients.length > 0 && <p className="text-xs text-status-warning-fg">{t("mcpConex.pendientes", { cuantos: invalidClients.length, plataforma: platform.name })}</p>}
            <div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" className="gap-1.5" onClick={() => window.open(platform.docsUrl, "_blank", "noopener,noreferrer")}><ExternalLink size={14} /> {t("mcpConex.abrir", { plataforma: platform.name })}</Button><Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(platform.docsUrl, "_blank", "noopener,noreferrer")}><ExternalLink size={14} /> {t("mcpConex.guia", { plataforma: platform.name })}</Button>{platform.connections.filter((connection) => connection.status !== "revoked").map((connection) => <Button key={connection.id} type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={() => revoke(connection.id)} disabled={revoking === connection.id}>{revoking === connection.id ? <Spinner className="size-3.5" /> : <Users size={14} />} {t("mcpConex.revocar")}</Button>)}</div>
          </div>}
        </Card>;
      })}
    </div>}
  </div>;
}
