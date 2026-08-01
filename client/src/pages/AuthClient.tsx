import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

// A client account never self-registers — it's created server-side the
// moment the business approves their first estimate (see ensureClientAccount
// in server/api.ts). So a failed login here always gets this same friendly
// message, whether the email has no account at all or the password is
// simply wrong — we don't want to leak which.
const LOGIN_FAILED_MESSAGE =
  "No encontramos una cuenta con estos datos. Si aún no has hablado con la empresa, contáctala directamente para comenzar.";

export default function AuthClient() {
  const [, setLocation] = useLocation();
  const { session, signOut, refreshPersona } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(LOGIN_FAILED_MESSAGE);
      await refreshPersona();
      setLocation("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : LOGIN_FAILED_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <button
          onClick={async () => {
            if (session) await signOut();
            setLocation("/");
          }}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <ArrowLeft size={13} /> Volver
        </button>

        <div className="text-center space-y-2">
          <UserRound className="mx-auto text-primary" size={28} />
          <h1 className="text-xl font-semibold text-foreground">Inicia sesión — Cliente</h1>
          <p className="text-sm text-muted-foreground">
            Tu contratista te avisa cuando tu cuenta esté lista, con instrucciones para entrar.
          </p>
        </div>

        <Card className="p-6">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-status-error-fg">{error}</p>}

            <Button type="submit" className="w-full" disabled={!email || !password || busy}>
              Iniciar sesión
            </Button>

            <Link
              href="/recuperar-password"
              className="text-xs text-muted-foreground hover:text-foreground block text-center"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </form>
        </Card>
      </div>
    </div>
  );
}
