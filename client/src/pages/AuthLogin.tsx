import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch, readJson } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

export default function AuthLogin() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { refreshPersona } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      await refreshPersona();

      const res = await apiFetch("/api/auth/me");
      const body = await readJson(res);
      if (body.persona === "client") setLocation("/portal");
      else if (body.persona === "business") setLocation("/");
      else setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.wrongCredentials"));
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
          <LogIn className="mx-auto text-foreground" size={28} strokeWidth={1.5} />
          <h1 className="text-xl font-semibold text-foreground">{t("auth.loginTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.worksForBoth")}</p>
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-status-error-fg">{error}</p>}

            <Button type="submit" className="w-full" disabled={!email || !password || busy}>
              {t("auth.loginTitle")}
            </Button>

            <Link href="/recuperar-password" className="text-xs text-muted-foreground hover:text-foreground block text-center">
              {t("auth.forgotPassword")}
            </Link>
          </form>
        </Card>

        <p className="text-sm text-center text-muted-foreground">
          {t("auth.noBusinessAccount")}{" "}
          <Link href="/negocio/acceso" className="text-primary hover:underline">{t("auth.signUpLink")}</Link>
        </p>
      </div>
    </div>
  );
}
