import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useTranslation } from "react-i18next";

/** Un mensaje que no le dice nada a nadie. En la pantalla salía literalmente
 *  "{}" cuando el servidor de correo fallaba: el error venía con el cuerpo de
 *  la respuesta serializado y sin texto dentro. */
function inservible(texto: string) {
  const t = texto.trim();
  return !t || t === "{}" || t === "[object Object]" || t === "null" || t === "undefined";
}

function formatError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  const bruto =
    typeof err === "string"
      ? err
      : err instanceof Error
      ? err.message
      : typeof err === "object"
      ? (() => {
          const obj = err as Record<string, unknown>;
          for (const clave of ["message", "msg", "error_description", "error"]) {
            const v = obj[clave];
            if (typeof v === "string" && v) return v;
          }
          return "";
        })()
      : "";
  return inservible(bruto) ? fallback : bruto;
}

/**
 * Cuando el fallo es que el correo no sale.
 *
 * Supabase contesta 500 "Error sending recovery email" si el proyecto no tiene
 * servidor de correo configurado. Eso, tal cual, deja al usuario pulsando el
 * botón otra vez para siempre: no es un código mal escrito ni una espera, es
 * que no le va a llegar nada nunca. Merece decirse con esas palabras.
 */
function esFalloDeCorreo(err: unknown): boolean {
  const obj = (typeof err === "object" && err ? err : {}) as Record<string, unknown>;
  // El 500 se mira además del texto porque el cliente no siempre deja pasar el
  // "msg" del servidor: a veces sólo llega el estado y un mensaje vacío, que
  // es exactamente el caso que pintaba "{}".
  if (Number(obj.status) === 500 || String(obj.code) === "unexpected_failure") return true;
  const texto = [
    err instanceof Error ? err.message : "",
    String(obj.msg ?? ""),
    String(obj.error_description ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return texto.includes("sending") && texto.includes("email");
}

/**
 * Pide el código de recuperación por nuestra ruta, diciéndole el idioma.
 *
 * No devuelve si la cuenta existe —el servidor contesta lo mismo en los dos
 * casos a propósito—, así que aquí sólo se mira que la petición llegara.
 */
async function pedirCodigoDeClave(email: string, lang: string): Promise<void> {
  const res = await fetch("/api/public/auth/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, lang }),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
}

export default function AuthForgotPassword() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
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
      // Por nuestra ruta y no por supabase.auth: así el correo sale en el
      // idioma que esta pantalla tiene puesto. Supabase manda el suyo en un
      // inglés fijo porque el idioma vive en el navegador y él no lo ve.
      await pedirCodigoDeClave(email, i18n.language);
      setSent(true);
    } catch (err) {
      setError(esFalloDeCorreo(err) ? t("auth.emailNotSending") : formatError(err, t("auth.somethingWentWrong")));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setError(null);
    setResent(false);
    try {
      await pedirCodigoDeClave(email, i18n.language);
      setResent(true);
    } catch (err) {
      setError(esFalloDeCorreo(err) ? t("auth.emailNotSending") : formatError(err, t("auth.couldNotResendCode")));
    }
  };

  const confirmReset = async () => {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t("auth.passwordsDontMatch"));
      return;
    }
    setBusy(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error(t("worker.invalidCode"));

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      await supabase.auth.signOut();
      setLocation("/iniciar-sesion");
    } catch (err) {
      setError(formatError(err, t("auth.invalidOrExpiredCode")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/iniciar-sesion" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft size={13} /> {t("auth.backToSignIn")}
        </Link>

        <div className="text-center space-y-2">
          <KeyRound className="mx-auto text-foreground" size={28} strokeWidth={1.5} />
          <h1 className="text-xl font-semibold text-foreground">
            {sent ? t("auth.enterCodeAndNewPassword") : t("auth.recoverPassword")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {sent
              ? t("auth.codeSentShort", { email })
              : t("auth.recoverPasswordHint")}
          </p>
        </div>

        <Card className="p-6">
          {sent ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                confirmReset();
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

              <div className="space-y-1.5">
                <Label htmlFor="newPassword">{t("auth.newPassword")}</Label>
                <Input
                  id="newPassword"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-status-error-fg text-center">{error}</p>}
              {resent && !error && <p className="text-sm text-status-success-fg text-center">{t("auth.codeResent")}</p>}

              <Button
                type="submit"
                className="w-full"
                disabled={code.length !== 8 || !newPassword || !confirmPassword || busy}
              >
                {t("auth.changePassword")}
              </Button>
              <button
                type="button"
                onClick={resendCode}
                className="text-xs text-muted-foreground hover:text-foreground block text-center w-full"
              >
                {t("auth.resendCode")}
              </button>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                requestCode();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("common.email")}</Label>
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
              {error && <p className="text-sm text-status-error-fg">{error}</p>}
              <Button type="submit" className="w-full" disabled={!email || busy}>
                {t("auth.sendCode")}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
