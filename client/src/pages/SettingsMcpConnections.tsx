import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Check, ChevronDown, ChevronUp, Copy, ExternalLink, KeyRound, Link2, MessageCircle, ShieldCheck, Sparkles, Users, X } from "lucide-react";
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
  id: "claude" | "chatgpt" | "manus" | "gemini";
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

const brand: Record<Platform["id"], { bg: string; fg: string; Icon: typeof Bot; mark: string }> = {
  claude: { bg: "bg-[#f3e5d5]", fg: "text-[#9a5b24]", Icon: MessageCircle, mark: "C" },
  chatgpt: { bg: "bg-[#dff4ec]", fg: "text-[#14795c]", Icon: Bot, mark: "✳" },
  manus: { bg: "bg-[#e5e7ff]", fg: "text-[#4b4fc4]", Icon: Sparkles, mark: "M" },
  gemini: { bg: "bg-[#e1efff]", fg: "text-[#2870c7]", Icon: Sparkles, mark: "✦" },
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return <Button type="button" size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copiado" : label}</Button>;
}

function Logo({ id }: { id: Platform["id"] }) {
  const item = brand[id];
  if (id === "claude") {
    return <div className={`size-11 rounded-xl ${item.bg} flex items-center justify-center overflow-hidden`}><img src="/brand/claude-logo.svg" alt="Claude" className="size-8 object-contain" /></div>;
  }
  return <div className={`size-11 rounded-xl ${item.bg} ${item.fg} flex items-center justify-center font-bold text-xl`} aria-hidden="true">{item.mark}</div>;
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
      if (!response.ok) throw new Error(serverMessage(await readJson(response), t, "No se pudo revocar la conexión."));
      setNotice("Conexión revocada. La herramienta ya no podrá consultar Field.");
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "No se pudo revocar la conexión.");
    } finally {
      setRevoking(null);
    }
  };

  return <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
    <PageHeader title="MCP Conexiones AI" description="Conecta Claude a los datos de Field que tu rol y tu plan permiten consultar." />
    <Card className="p-5 sm:p-6 border-primary/20 bg-primary/[0.03]">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck size={20} /></div>
        <div className="space-y-1">
          <h2 className="font-semibold">Solo lectura y siempre revocable</h2>
          <p className="text-sm text-muted-foreground">Las conexiones usan OAuth y PKCE. No compartas contraseñas ni códigos por el chat: la autorización se completa en la pantalla segura de Field.</p>
          <p className="text-sm text-muted-foreground">Alcance activo: <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{data?.scope ?? "mcp:read"}</code></p>
        </div>
      </div>
    </Card>
    {loading && <div className="flex justify-center py-12 text-muted-foreground"><Spinner className="size-5" /></div>}
    {error && <AvisoDeFallo mensaje={`No se pudo cargar MCP Conexiones AI: ${error}`} detalle={detalle} onReintentar={reload} />}
    {notice && <div className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm flex items-center justify-between gap-3"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Cerrar"><X size={15} /></button></div>}
    {!loading && !error && <div className="grid gap-4 md:grid-cols-2">
      {platforms.map((platform) => {
        const isOpen = open === platform.id;
        const style = brand[platform.id];
        const validClient = platform.clients.find((client) => client.valid);
        const invalidClients = platform.clients.filter((client) => !client.valid);
        return <Card key={platform.id} className="overflow-hidden">
          <button type="button" className="w-full text-left p-5 flex items-start gap-3 hover:bg-secondary/40 transition-colors" onClick={() => setOpen(isOpen ? null : platform.id)} aria-expanded={isOpen}>
            <Logo id={platform.id} />
            <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-semibold">{platform.name}{platform.configured && <span title="Hay un Client ID OAuth válido registrado para Claude" className="text-[11px] rounded-full bg-status-success-bg text-status-success-fg px-2 py-0.5">OAuth listo</span>}{platform.connections.some((connection) => connection.status === "active") && <span title="Existe una autorización activa para esta empresa" className="text-[11px] rounded-full bg-status-success-bg text-status-success-fg px-2 py-0.5">Conectado</span>}</span><span className="block text-sm text-muted-foreground mt-1">{platform.description}</span></span>
            {isOpen ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
          </button>
          {isOpen && <div className="border-t border-border p-5 space-y-5">
            <div className="space-y-3 text-sm">
              <p className="font-medium">Cómo conectarlo</p>
              <p className="text-xs text-muted-foreground"><strong>OAuth listo</strong> significa que Field tiene registrado un Client ID válido. <strong>Conectado</strong> significa que ya existe una autorización activa para esta empresa.</p>
              <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground"><li>Abre {platform.name} y añade un conector MCP personalizado.</li><li>Copia la URL MCP y el Client ID que aparecen abajo.</li><li>Cuando {platform.name} abra Field, inicia sesión como propietario o usa el código del trabajador.</li><li>Revisa que diga <strong>solo lectura</strong> y pulsa autorizar.</li></ol>
            </div>
            <div className="space-y-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Link2 size={13} /> URL MCP</p><div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2"><code className="min-w-0 flex-1 truncate text-xs">{data?.mcpUrl ?? "https://logiciel-construction.com/mcp"}</code><CopyButton value={data?.mcpUrl ?? "https://logiciel-construction.com/mcp"} label="Copiar" /></div></div>
            {validClient ? <div className="space-y-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><KeyRound size={13} /> OAuth Client ID</p><div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2"><code className="min-w-0 flex-1 truncate text-xs">{validClient.clientId}</code><CopyButton value={validClient.clientId} label="Copiar" /></div><p className="text-xs text-muted-foreground">Callback: {validClient.redirectUris[0] ?? "No indicado"}</p></div> : <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">Todavía no hay un Client ID válido de {platform.name}. Cuando se registre, aparecerá aquí con su callback oficial.</div>}
            {invalidClients.length > 0 && <p className="text-xs text-status-warning-fg">Hay {invalidClients.length} registro(s) pendiente(s) de corregir: su callback no corresponde a {platform.name}.</p>}
            <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(platform.docsUrl, "_blank", "noopener,noreferrer")}><ExternalLink size={14} /> Guía de {platform.name}</Button>{platform.connections.filter((connection) => connection.status !== "revoked").map((connection) => <Button key={connection.id} type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={() => revoke(connection.id)} disabled={revoking === connection.id}>{revoking === connection.id ? <Spinner className="size-3.5" /> : <Users size={14} />} Revocar conexión</Button>)}</div>
          </div>}
        </Card>;
      })}
    </div>}
  </div>;
}

export { Logo };
