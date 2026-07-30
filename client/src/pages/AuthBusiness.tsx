import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Briefcase } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthBusiness() {
  const [, setLocation] = useLocation();
  const { session, persona, refreshPersona } = useAuth();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  // Reached after clicking the confirmation link in the signup email: Supabase
  // already produced a session, but register-business was never called back
  // when signUp() first ran (no session existed yet at that point).
  useEffect(() => {
    if (!session || persona !== "none") return;
    (async () => {
      setBusy(true);
      try {
        const res = await apiFetch("/api/auth/register-business", { method: "POST" });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "No se pudo crear el negocio");
        await refreshPersona();
        setLocation("/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Algo salió mal");
      } finally {
        setBusy(false);
      }
    })();
  }, [session, persona]);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/negocio/acceso` },
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          // Email confirmation required — can't provision the business yet.
          setNeedsConfirmation(true);
          return;
        }

        const res = await apiFetch("/api/auth/register-business", { method: "POST" });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "No se pudo crear el negocio");
        await refreshPersona();
        setLocation("/");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        await refreshPersona();
        setLocation("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
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
          <Briefcase className="mx-auto text-primary" size={28} />
          <h1 className="text-xl font-semibold text-foreground">
            {mode === "register" ? "Crea la cuenta de tu negocio" : "Inicia sesión — Negocio"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "register"
              ? "Solo necesitas correo y contraseña. Los datos de tu empresa se completan después, en Configuración."
              : "Ingresa con el correo y contraseña de tu negocio."}
          </p>
        </div>

        <Card className="p-6 space-y-4">
          {needsConfirmation ? (
            <p className="text-sm text-status-success-fg text-center">
              Revisa tu correo <strong>{email}</strong> y confirma tu cuenta para continuar.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>

              {error && <p className="text-sm text-status-error-fg">{error}</p>}

              <Button className="w-full" onClick={submit} disabled={!email || !password || busy}>
                {mode === "register" ? "Crear cuenta" : "Iniciar sesión"}
              </Button>

              {mode === "login" && (
                <Link href="/recuperar-password" className="text-xs text-muted-foreground hover:text-foreground block text-center">
                  ¿Olvidaste tu contraseña?
                </Link>
              )}
            </>
          )}
        </Card>

        {!needsConfirmation && (
          <p className="text-sm text-center text-muted-foreground">
            {mode === "register" ? "¿Ya tienes cuenta?" : "¿Todavía no tienes cuenta?"}{" "}
            <button
              onClick={() => setMode(mode === "register" ? "login" : "register")}
              className="text-primary hover:underline"
            >
              {mode === "register" ? "Inicia sesión" : "Regístrate"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
