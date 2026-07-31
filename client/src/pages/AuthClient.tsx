import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthClient() {
  const [, setLocation] = useLocation();
  const { session, persona, refreshPersona, signOut } = useAuth();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);

  // Safety net: if a session ever appears (e.g. an old confirmation link from
  // before this code-based flow existed) without claim-client having run.
  useEffect(() => {
    if (!session || persona !== "none") return;
    (async () => {
      setBusy(true);
      try {
        const res = await apiFetch("/api/auth/claim-client", { method: "POST" });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || "No se pudo vincular tu cuenta");
        await refreshPersona();
        setLocation("/portal");
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
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setNeedsCode(true);
          return;
        }

        const res = await apiFetch("/api/auth/claim-client", { method: "POST" });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || "No se pudo vincular tu cuenta");
        await refreshPersona();
        setLocation("/portal");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        await refreshPersona();
        setLocation("/portal");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setError(null);
    setBusy(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error("Código inválido");

      const res = await apiFetch("/api/auth/claim-client", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "No se pudo vincular tu cuenta");
      await refreshPersona();
      setLocation("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido o expirado");
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setError(null);
    setResent(false);
    try {
      const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
      if (resendError) throw resendError;
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reenviar el código");
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
          <h1 className="text-xl font-semibold text-foreground">
            {needsCode ? "Verifica tu correo" : mode === "register" ? "Accede a tu Client Portal" : "Inicia sesión — Cliente"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {needsCode
              ? `Enviamos un código de 8 dígitos a ${email}. Ingrésalo para continuar.`
              : mode === "register"
                ? "Usa el mismo correo o teléfono que le diste a tu contratista."
                : "Ingresa con el correo y contraseña de tu cuenta."}
          </p>
        </div>

        <Card className="p-6">
          {needsCode ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                verifyCode();
              }}
            >
              <div className="flex justify-center">
                <InputOTP maxLength={8} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                    <InputOTPSlot index={6} />
                    <InputOTPSlot index={7} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && <p className="text-sm text-status-error-fg text-center">{error}</p>}
              {resent && !error && <p className="text-sm text-status-success-fg text-center">Código reenviado.</p>}

              <Button type="submit" className="w-full" disabled={code.length !== 8 || busy}>
                Verificar código
              </Button>
              <button
                type="button"
                onClick={resendCode}
                className="text-xs text-muted-foreground hover:text-foreground block text-center w-full"
              >
                Reenviar código
              </button>
            </form>
          ) : (
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
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-status-error-fg">{error}</p>}

              <Button type="submit" className="w-full" disabled={!email || !password || busy}>
                {mode === "register" ? "Crear cuenta" : "Iniciar sesión"}
              </Button>

              {mode === "login" && (
                <Link href="/recuperar-password" className="text-xs text-muted-foreground hover:text-foreground block text-center">
                  ¿Olvidaste tu contraseña?
                </Link>
              )}
            </form>
          )}
        </Card>

        {!needsCode && (
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
