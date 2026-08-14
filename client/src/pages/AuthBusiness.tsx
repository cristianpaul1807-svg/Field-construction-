import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, Briefcase } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch, readJson } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

function formatError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.error_description === "string" && obj.error_description) return obj.error_description;
    if (typeof obj.error === "string" && obj.error) return obj.error;
  }
  return fallback;
}

export default function AuthBusiness() {
  const { t } = useTranslation();
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

  // Safety net: if a session ever appears without register-business having run.
  useEffect(() => {
    if (!session || persona !== "none") return;
    (async () => {
      setBusy(true);
      try {
        const res = await apiFetch("/api/auth/register-business", { method: "POST" });
        if (!res.ok) {
          const body = await readJson(res);
          throw new Error(body?.error || t("auth.couldNotCreateBusiness"));
        }
        await refreshPersona();
        setLocation("/");
      } catch (err) {
        setError(formatError(err, t("auth.somethingWentWrong")));
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
          // Email confirmation required — show 8-digit OTP code input
          setNeedsCode(true);
          return;
        }

        const res = await apiFetch("/api/auth/register-business", { method: "POST" });
        if (!res.ok) {
          const body = await readJson(res);
          throw new Error(body?.error || t("auth.couldNotCreateBusiness"));
        }
        await refreshPersona();
        setLocation("/");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        await refreshPersona();
        setLocation("/");
      }
    } catch (err) {
      setError(formatError(err, t("auth.somethingWentWrong")));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setError(null);
    setBusy(true);
    try {
      let verifyRes = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
      if (verifyRes.error) {
        verifyRes = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      }
      if (verifyRes.error) throw verifyRes.error;
      if (!verifyRes.data.session) throw new Error(t("worker.invalidCode"));

      const res = await apiFetch("/api/auth/register-business", { method: "POST" });
      if (!res.ok) {
        const body = await readJson(res);
        throw new Error(body?.error || t("auth.couldNotCreateBusiness"));
      }
      await refreshPersona();
      setLocation("/");
    } catch (err) {
      setError(formatError(err, t("auth.invalidOrExpiredCode")));
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
      setError(formatError(err, t("auth.couldNotResendCode")));
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
          <ArrowLeft size={13} /> {t("common.back")}
        </button>

        <div className="text-center space-y-2">
          <Briefcase className="mx-auto text-foreground" size={28} strokeWidth={1.5} />
          <h1 className="text-xl font-semibold text-foreground">
            {needsCode ? t("auth.verifyYourEmail") : mode === "register" ? t("auth.createBusinessAccount") : t("auth.signInBusiness")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {needsCode
              ? t("auth.codeSentTo", { email })
              : mode === "register"
                ? t("auth.registerHint")
                : t("auth.signInBusinessHint")}
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
              {resent && !error && <p className="text-sm text-status-success-fg text-center">{t("auth.codeResent")}</p>}

              <Button type="submit" className="w-full" disabled={code.length !== 8 || busy}>
                {t("auth.verifyCode")}
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
                submit();
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
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("auth.password")}</Label>
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
                {mode === "register" ? t("auth.createAccount") : t("auth.loginTitle")}
              </Button>

              {mode === "login" && (
                <Link href="/recuperar-password" className="text-xs text-muted-foreground hover:text-foreground block text-center">
                  {t("auth.forgotPassword")}
                </Link>
              )}
            </form>
          )}
        </Card>

        {!needsCode && (
          <p className="text-sm text-center text-muted-foreground">
            {mode === "register" ? t("auth.alreadyHaveAccount") : t("auth.notYetAccount")}{" "}
            <button
              onClick={() => setMode(mode === "register" ? "login" : "register")}
              className="text-primary hover:underline"
            >
              {mode === "register" ? t("auth.signIn") : t("auth.signUpLink")}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
