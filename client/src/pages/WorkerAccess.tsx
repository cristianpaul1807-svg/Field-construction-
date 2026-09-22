import { readJson } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CalendarDays, Check, ChevronDown, ChevronUp, Clock, Copy, HardHat, LogOut, MessageCircle, Sparkles, Unlink } from "lucide-react";
import { getWorkerSession, setWorkerSession, clearWorkerSession, type WorkerSession } from "@/lib/workerSession";
import { WorkerScheduleView } from "@/components/WorkerScheduleView";
import { WorkerClock } from "@/components/WorkerClock";
import { WorkerChat } from "@/components/WorkerChat";
import { WorkerAgreementBanner } from "@/components/WorkerAgreementBanner";
import { WorkerPapeles } from "@/components/WorkerPapeles";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { MarcaDelNegocio } from "@/components/MarcaDelNegocio";
import { StatusBadge } from "@/components/StatusBadge";
import { workerApiFetch } from "@/lib/workerSession";

/**
 * Si este trabajador tiene la IA conectada, en un solo sitio.
 *
 * Lo leen el distintivo de la cabecera y el panel de abajo. Tenerlo dos veces
 * sería dos peticiones y, el día que una falle, un distintivo verde encima de
 * un panel que dice que no está conectado.
 */
function useEstadoMcp() {
  const [estado, setEstado] = useState<{ activo: boolean; url: string } | null>(null);
  const cargar = useCallback(() => {
    workerApiFetch("/api/worker/mcp-status")
      .then((r) => r.json())
      .then((d) => setEstado({ activo: Boolean(d.active), url: String(d.mcpUrl ?? "") }))
      .catch(() => setEstado(null));
  }, []);
  useEffect(cargar, [cargar]);
  return { estado, recargar: cargar };
}

function WorkerMcpBadge({ activo }: { activo: boolean }) {
  const { t } = useTranslation();
  if (!activo) return null;
  return (
    <StatusBadge tone="success" className="ml-2 scale-90 origin-left">
      MCP {t("worker.mcpConectado")}
    </StatusBadge>
  );
}

/**
 * Cómo conectar la IA, y cómo soltarla.
 *
 * Antes sólo había un distintivo verde en la cabecera, y **sólo cuando ya
 * estaba conectado**: quien no lo estaba no veía nada, así que no había forma
 * de enterarse de que esto existe. Y quien sí lo estaba tenía un cartel que no
 * llevaba a ningún sitio.
 *
 * Va plegado y encima de las pestañas. Plegado porque no es trabajo diario:
 * se hace una vez. Encima de las pestañas porque no es una cuarta sección —
 * las tres que hay son toda la navegación de alguien que las toca con guantes.
 *
 * El texto no dice «MCP» ni «OAuth» en ningún sitio. A quien está en la obra
 * le importa poder preguntar qué tiene mañana; cómo se llama el protocolo por
 * dentro es asunto nuestro.
 */
function WorkerMcp({ estado, recargar }: { estado: { activo: boolean; url: string } | null; recargar: () => void }) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [soltando, setSoltando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Sin respuesta todavía, o sin conexión: no se pinta un panel que a lo mejor
  // no hace falta. Vuelve solo cuando el estado llega.
  if (!estado) return null;

  const copiar = async () => {
    await navigator.clipboard.writeText(estado.url);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1600);
  };

  const soltar = async () => {
    setSoltando(true);
    setAviso(null);
    try {
      const respuesta = await workerApiFetch("/api/worker/mcp-revoke", { method: "POST" });
      if (!respuesta.ok) throw new Error();
      setAviso(t("worker.mcpDesconectado"));
      recargar();
    } catch {
      setAviso(t("worker.mcpNoDesconecta"));
    } finally {
      setSoltando(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        className="w-full min-h-12 px-4 py-3 flex items-center gap-3 text-left"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
      >
        <Sparkles size={18} className="text-primary shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{t("worker.mcpTitulo")}</span>
          {estado.activo && <span className="block text-xs text-status-success-fg">{t("worker.mcpConectado")}</span>}
        </span>
        {abierto ? <ChevronUp size={18} className="text-muted-foreground shrink-0" /> : <ChevronDown size={18} className="text-muted-foreground shrink-0" />}
      </button>

      {abierto && (
        <div className="border-t border-border px-4 py-4 space-y-3 text-sm">
          <p className="text-muted-foreground">{t("worker.mcpResumen")}</p>
          <p className="text-muted-foreground italic">{t("worker.mcpEjemplo")}</p>

          {estado.activo ? (
            <>
              <p className="text-foreground">{t("worker.mcpYaConectado")}</p>
              <Button variant="outline" size="sm" className="min-h-11 gap-2" onClick={soltar} disabled={soltando}>
                <Unlink size={15} /> {soltando ? t("worker.mcpDesconectando") : t("worker.mcpDesconectar")}
              </Button>
            </>
          ) : (
            <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
              <li>{t("worker.mcpPaso1")}</li>
              <li>
                {t("worker.mcpPaso2")}
                <span className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2">
                  <code className="min-w-0 flex-1 truncate text-xs">{estado.url}</code>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5 shrink-0 min-h-11" onClick={copiar}>
                    {copiado ? <Check size={14} /> : <Copy size={14} />}
                    <span className="sr-only sm:not-sr-only">{copiado ? t("worker.mcpCopiado") : t("worker.mcpCopiar")}</span>
                  </Button>
                </span>
              </li>
              <li>{t("worker.mcpPaso3")}</li>
            </ol>
          )}

          {/* Lo que la IA **no** puede hacer, y va siempre: alguien a quien le
              piden conectar su cuenta a algo tiene derecho a saber el límite
              antes de decir que sí, no después. */}
          <p className="text-xs text-muted-foreground border-t border-border pt-3">{t("worker.mcpSoloLectura")}</p>

          {aviso && <p className="text-sm text-foreground">{aviso}</p>}
        </div>
      )}
    </div>
  );
}

function WorkerLoginForm({ onLoggedIn }: { onLoggedIn: (session: WorkerSession) => void }) {
  const { t } = useTranslation();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/worker-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const body = await readJson(res);
      // "We could not check" is not "your code is wrong": one sends them
      // looking for a card that was never the problem.
      if (body?.code === "backend_unavailable") throw new Error(t("worker.serviceDown"));
      if (!res.ok) throw new Error(t("worker.invalidCode"));
      const session: WorkerSession = { token: token.trim(), id: body.id, name: body.name, businessId: body.businessId, kind: body.kind };
      setWorkerSession(session);
      onLoggedIn(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("worker.invalidCode"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft size={13} /> {t("common.back")}
        </Link>

        <div className="text-center space-y-2">
          <Logo size={44} className="mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">{t("worker.accessTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("worker.accessDescription")}
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="token">{t("worker.accessCode")}</Label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
              // El código distingue mayúsculas de minúsculas ("JO8drBvK59v2") y
              // iOS, por su cuenta, pone mayúscula en la primera letra y pasa
              // el autocorrector. El trabajador teclearía el código bien y le
              // saldría "código inválido" sin entender por qué.
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={!token.trim() || busy}>
            {t("worker.enter")}
          </Button>
        </Card>
      </div>
    </div>
  );
}

function WorkerHome({ session, onLogout }: { session: WorkerSession; onLogout: () => void }) {
  const { t } = useTranslation();
  // Una sola consulta para el distintivo de arriba y el panel de abajo.
  const { estado: estadoMcp, recargar: recargarMcp } = useEstadoMcp();
  return (
    <div className="min-h-screen bg-background pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="border-b border-border bg-card px-4 sm:px-6 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* El logotipo de su empresa, no el nuestro: esta app se la da su
              jefe. Sin logotipo, la inicial del negocio; si la sesión es de
              antes de que esto existiera, el casco de siempre. */}
          {session.businessName ? (
            <MarcaDelNegocio
              logoUrl={session.businessLogoUrl}
              name={session.businessName}
              size={32}
              recurso="inicial"
            />
          ) : (
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold text-sm flex-shrink-0">
              <HardHat size={16} />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight flex items-center">
              <span className="truncate">{session.name}</span>
              <WorkerMcpBadge activo={Boolean(estadoMcp?.activo)} />
            </p>
            <p className="text-xs text-muted-foreground leading-tight truncate">
              {session.businessName
                ? `${session.businessName} · ${session.kind === "employee" ? t("worker.employee") : t("worker.subcontractor")}`
                : session.kind === "employee"
                  ? t("worker.employee")
                  : t("worker.subcontractor")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <Button variant="ghost" size="sm" className="gap-2 min-h-11" onClick={onLogout}>
            <LogOut size={16} /> {t("worker.exit")}
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
        {/* Encima de las pestañas y no dentro: un acuerdo sin firmar no es una
            sección donde entrar, es algo que hay que resolver antes de seguir.
            Cuando no hay nada pendiente no pinta nada. */}
        <WorkerAgreementBanner workerName={session.name} />
        <WorkerPapeles />
        <WorkerMcp estado={estadoMcp} recargar={recargarMcp} />

        <Tabs defaultValue="agenda">
          {/* Estas tres pestañas son toda la navegación del trabajador y se
              tocan con guantes, de pie y con prisa. Medían 29 px de alto:
              Apple pide 44 y Google 48, y por debajo de eso el dedo falla y hay
              que repetir. Es la única pantalla del producto donde el tamaño del
              dedo es un requisito, no un detalle. */}
          <TabsList className="w-full h-auto">
            <TabsTrigger value="agenda" className="flex-1 gap-1.5 min-h-11">
              <CalendarDays size={16} /> {t("worker.schedule")}
            </TabsTrigger>
            <TabsTrigger value="timbrado" className="flex-1 gap-1.5 min-h-11">
              <Clock size={16} /> {t("worker.timeclock")}
            </TabsTrigger>
            <TabsTrigger value="mensajes" className="flex-1 gap-1.5 min-h-11">
              <MessageCircle size={16} /> {t("worker.messages")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agenda" className="mt-4">
            <WorkerScheduleView />
          </TabsContent>

          <TabsContent value="timbrado" className="mt-4">
            <WorkerClock />
          </TabsContent>

          <TabsContent value="mensajes" className="mt-4">
            <WorkerChat />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function WorkerAccess() {
  const [session, setSession] = useState<WorkerSession | null | undefined>(undefined);

  useEffect(() => {
    setSession(getWorkerSession());
  }, []);

  if (session === undefined) return null;

  if (!session) {
    return <WorkerLoginForm onLoggedIn={setSession} />;
  }

  return (
    <WorkerHome
      session={session}
      onLogout={() => {
        clearWorkerSession();
        setSession(null);
      }}
    />
  );
}
