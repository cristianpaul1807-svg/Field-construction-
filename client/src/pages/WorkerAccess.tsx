import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, HardHat, LogOut, CalendarDays, Clock, MessageCircle } from "lucide-react";
import { getWorkerSession, setWorkerSession, clearWorkerSession, type WorkerSession } from "@/lib/workerSession";
import { WorkerScheduleView } from "@/components/WorkerScheduleView";
import { WorkerClock } from "@/components/WorkerClock";
import { WorkerChat } from "@/components/WorkerChat";

function WorkerLoginForm({ onLoggedIn }: { onLoggedIn: (session: WorkerSession) => void }) {
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
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Código inválido");
      const session: WorkerSession = { token: token.trim(), id: body.id, name: body.name, businessId: body.businessId, kind: body.kind };
      setWorkerSession(session);
      onLoggedIn(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft size={13} /> Volver
        </Link>

        <div className="text-center space-y-2">
          <HardHat className="mx-auto text-primary" size={28} />
          <h1 className="text-xl font-semibold text-foreground">Acceso de trabajador</h1>
          <p className="text-sm text-muted-foreground">
            Ingresa el código que te dio tu empresa — no necesitas correo ni contraseña.
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="token">Código de acceso</Label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
              className="font-mono"
            />
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={!token.trim() || busy}>
            Entrar
          </Button>
        </Card>
      </div>
    </div>
  );
}

function WorkerHome({ session, onLogout }: { session: WorkerSession; onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold text-sm">
            <HardHat size={16} />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm leading-tight">{session.name}</p>
            <p className="text-xs text-muted-foreground leading-tight">
              {session.kind === "employee" ? "Empleado" : "Subcontratista"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="gap-2" onClick={onLogout}>
          <LogOut size={14} /> Salir
        </Button>
      </div>

      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <Tabs defaultValue="agenda">
          <TabsList className="w-full">
            <TabsTrigger value="agenda" className="flex-1 gap-1.5">
              <CalendarDays size={14} /> Agenda
            </TabsTrigger>
            <TabsTrigger value="timbrado" className="flex-1 gap-1.5">
              <Clock size={14} /> Timbrado
            </TabsTrigger>
            <TabsTrigger value="mensajes" className="flex-1 gap-1.5">
              <MessageCircle size={14} /> Mensajes
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
