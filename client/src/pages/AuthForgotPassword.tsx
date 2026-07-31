import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthForgotPassword() {
  const [, setLocation] = useLocation();
  const { refreshPersona } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);

  const requestCode = async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setError(null);
    setResent(false);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reenviar el código");
    }
  };

  const confirmReset = async () => {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error("Código inválido");

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      await refreshPersona();
      const res = await apiFetch("/api/auth/me");
      const body = await res.json().catch(() => null);
      setLocation(body?.persona === "client" ? "/portal" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido o expirado");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/iniciar-sesion" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft size={13} /> Volver a iniciar sesión
        </Link>

        <div className="text-center space-y-2">
          <KeyRound className="mx-auto text-primary" size={28} />
          <h1 className="text-xl font-semibold text-foreground">
            {sent ? "Ingresa el código y tu nueva contraseña" : "Recuperar contraseña"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {sent
              ? `Enviamos un código de 8 dígitos a ${email}.`
              : "Te mandamos un código para crear una contraseña nueva."}
          </p>
        </div>

        <Card className="p-6 space-y-4">
          {sent ? (
            <>
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

              <div className="space-y-1.5">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmReset()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmReset()}
                />
              </div>

              {error && <p className="text-sm text-status-error-fg text-center">{error}</p>}
              {resent && !error && <p className="text-sm text-status-success-fg text-center">Código reenviado.</p>}

              <Button
                className="w-full"
                onClick={confirmReset}
                disabled={code.length !== 8 || !newPassword || !confirmPassword || busy}
              >
                Cambiar contraseña
              </Button>
              <button
                onClick={resendCode}
                className="text-xs text-muted-foreground hover:text-foreground block text-center w-full"
              >
                Reenviar código
              </button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && requestCode()}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-status-error-fg">{error}</p>}
              <Button className="w-full" onClick={requestCode} disabled={!email || busy}>
                Enviar código
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
