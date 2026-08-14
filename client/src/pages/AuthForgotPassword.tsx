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

export default function AuthForgotPassword() {
  const { t } = useTranslation();
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
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.somethingWentWrong"));
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
      setError(err instanceof Error ? err.message : t("auth.couldNotResendCode"));
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

      // Sign back out and send them to a normal login — verifyOtp() leaves a
      // session behind, but jumping straight into the app from here bypassed
      // /iniciar-sesion entirely and could land on the business-setup screen
      // for accounts with no business yet, which read as "reset is broken".
      await supabase.auth.signOut();
      setLocation("/iniciar-sesion");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.invalidOrExpiredCode"));
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
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
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
                disabled={code.length !== 6 || !newPassword || !confirmPassword || busy}
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
