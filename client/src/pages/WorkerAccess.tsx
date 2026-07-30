import { useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, HardHat, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface WorkerInfo {
  id: string;
  name: string;
  businessId: string;
  kind: "employee" | "subcontractor";
}

export default function WorkerAccess() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [worker, setWorker] = useState<WorkerInfo | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch("/api/worker-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Código inválido");
      setWorker(body);
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
          {worker ? (
            <div className="text-center space-y-2 py-2">
              <CheckCircle2 className="mx-auto text-status-success-fg" size={28} />
              <p className="text-sm font-medium text-foreground">Hola, {worker.name}</p>
              <p className="text-xs text-muted-foreground">Acceso concedido — pronto podrás ver tus trabajos aquí.</p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
