import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HardHat, LogIn, UserRound, ArrowRight, Building2, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch, readJson } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function Landing() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { refreshPersona } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      await refreshPersona();

      const res = await apiFetch("/api/auth/me");
      const body = await readJson(res);
      if (body.persona === "client") setLocation("/portal");
      else setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.wrongCredentials"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pt-[calc(0.5rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex justify-end px-4 py-3">
        <LanguageSwitcher />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-semibold shadow-md border border-primary/20">
              <HardHat size={28} strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{t("landing.hubName")}</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t("landing.intro")}
            </p>
          </div>

          {/* Direct Quick Login Card */}
          <Card className="p-6 space-y-5 shadow-sm border-border">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <LogIn size={18} className="text-primary" />
              <div>
                <h2 className="font-semibold text-foreground text-sm">{t("landing.loginQuickTitle")}</h2>
                <p className="text-xs text-muted-foreground">{t("landing.loginSubtitle")}</p>
              </div>
            </div>

            <form onSubmit={submitLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="quick-email" className="text-xs">{t("common.email")}</Label>
                <Input
                  id="quick-email"
                  type="email"
                  placeholder="empresa@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="quick-password" className="text-xs">{t("auth.password")}</Label>
                  <Link href="/recuperar-password" className="text-xs text-primary hover:underline">
                    {t("landing.forgotPasswordLink")}
                  </Link>
                </div>
                <Input
                  id="quick-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              {error && <p className="text-xs text-status-error-fg bg-status-error-bg/30 p-2.5 rounded-md">{error}</p>}

              <Button type="submit" className="w-full gap-2 font-medium" disabled={!email || !password || busy}>
                <LogIn size={16} /> {t("auth.loginTitle")}
              </Button>
            </form>

            <div className="pt-2 border-t border-border text-center">
              <Link href="/negocio/acceso" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-medium">
                <Building2 size={14} className="text-primary" />
                <span>{t("landing.registerBusinessLink")}</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </Card>

          {/* Quick Access Doors for Worker & Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/campo">
              <Card className="p-4 hover:border-primary/60 transition-colors cursor-pointer flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                  <HardHat size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground text-xs leading-snug">{t("landing.workerDoorTitle")}</h3>
                  <p className="text-[11px] text-muted-foreground truncate">{t("landing.workerDoorDesc")}</p>
                </div>
                <KeyRound size={14} className="text-muted-foreground flex-shrink-0" />
              </Card>
            </Link>

            <Link href="/cliente/acceso">
              <Card className="p-4 hover:border-primary/60 transition-colors cursor-pointer flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                  <UserRound size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground text-xs leading-snug">{t("landing.clientDoorTitle")}</h3>
                  <p className="text-[11px] text-muted-foreground truncate">{t("landing.clientDoorDesc")}</p>
                </div>
                <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
