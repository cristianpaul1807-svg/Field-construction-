import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HardHat, LogIn, UserRound, ArrowRight, Building2, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InstalarApp } from "@/components/InstalarApp";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch, readJson } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { tomarDestino } from "@/lib/destino";
import { faltanLosSeisDigitos, comprobarLosSeisDigitos } from "@/lib/dobleFactor";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function Landing() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { refreshPersona } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Quien tiene el doble factor puesto entra en dos pasos. Quien no, en uno:
  // esto sólo aparece si su cuenta lo lleva.
  const [pideCodigo, setPideCodigo] = useState(false);
  const [codigo, setCodigo] = useState("");

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      await refreshPersona();

      // La contraseña es correcta, pero la sesión todavía no está entera si
      // esta persona tiene el segundo paso puesto.
      if (await faltanLosSeisDigitos()) {
        setPideCodigo(true);
        return;
      }
      await entrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.wrongCredentials"));
    } finally {
      setBusy(false);
    }
  };

  const entrar = async () => {
    const res = await apiFetch("/api/auth/me");
    const body = await readJson(res);
    if (body.persona === "client") setLocation("/portal");
    else setLocation(tomarDestino() ?? "/");
  };

  const comprobar = async (valor: string) => {
    if (valor.length !== 6) return;
    setError(null);
    setBusy(true);
    const fallo = await comprobarLosSeisDigitos(valor);
    if (fallo) {
      setCodigo("");
      setBusy(false);
      setError(t("security.wrongCode"));
      return;
    }
    await refreshPersona();
    await entrar();
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pt-[max(2.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] px-3 sm:px-6">
      {/* Top Bar with Language Switcher */}
      <div className="flex justify-end px-1 py-1">
        <LanguageSwitcher />
      </div>

      <div className="flex-1 flex items-center justify-center py-2">
        <div className="w-full max-w-md space-y-3.5">
          {/* Header & Logo */}
          <div className="text-center space-y-1">
            <Logo size={48} className="mx-auto shadow-md" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-none pt-1">
              {t("landing.hubName")}
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground max-w-xs sm:max-w-sm mx-auto leading-tight">
              {t("landing.intro")}
            </p>
          </div>

          {/* Compact Quick Login Card */}
          <Card className="p-4 space-y-3 shadow-sm border-border">
            <div className="flex items-center gap-2 border-b border-border/80 pb-2">
              <LogIn size={15} className="text-primary" />
              <div>
                <h2 className="font-semibold text-foreground text-xs">{t("landing.loginQuickTitle")}</h2>
                <p className="text-[10px] text-muted-foreground">{t("landing.loginSubtitle")}</p>
              </div>
            </div>

            {/* El segundo paso sustituye al formulario en vez de aparecer
                debajo: la contraseña ya está dada, y dejarla en pantalla
                invita a volver a pulsar Iniciar sesión, que es lo que hace
                que el código caduque antes de escribirlo. */}
            {pideCodigo ? (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground text-center">{t("security.enterCode")}</p>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={codigo}
                    autoFocus
                    onChange={(v) => {
                      setCodigo(v);
                      if (v.length === 6) comprobar(v);
                    }}
                  >
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {error && <p className="text-[11px] text-status-error-fg bg-status-error-bg/30 p-2 rounded-md">{error}</p>}
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-foreground w-full text-center"
                  onClick={() => {
                    setPideCodigo(false);
                    setCodigo("");
                    setError(null);
                  }}
                >
                  {t("common.back")}
                </button>
              </div>
            ) : (
            <form onSubmit={submitLogin} className="space-y-2.5">
              <div className="space-y-1">
                <Label htmlFor="quick-email" className="text-[11px] font-medium">{t("common.email")}</Label>
                <Input
                  id="quick-email"
                  type="email"
                  placeholder={t("landing.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="quick-password" className="text-[11px] font-medium">{t("auth.password")}</Label>
                  <Link href="/recuperar-password" className="text-[10px] text-primary hover:underline">
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
                  className="h-8 text-xs"
                />
              </div>

              {error && <p className="text-[11px] text-status-error-fg bg-status-error-bg/30 p-2 rounded-md">{error}</p>}

              <Button type="submit" size="sm" className="w-full gap-2 h-9 text-xs font-medium" disabled={!email || !password || busy}>
                <LogIn size={14} /> {t("auth.loginTitle")}
              </Button>
            </form>
            )}

            <div className="pt-2 border-t border-border/80 text-center">
              <Link href="/negocio/acceso" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium">
                <Building2 size={13} className="text-primary" />
                <span>{t("landing.registerBusinessLink")}</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          </Card>

          {/* Quick Access Doors Side-by-Side on Mobile */}
          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/campo">
              <Card className="p-3 hover:border-primary/60 transition-colors cursor-pointer text-center space-y-1.5 h-full flex flex-col items-center justify-center">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <HardHat size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-xs leading-tight">{t("landing.workerDoorTitle")}</h3>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t("landing.workerDoorDesc")}</p>
                </div>
              </Card>
            </Link>

            <Link href="/cliente/acceso">
              <Card className="p-3 hover:border-primary/60 transition-colors cursor-pointer text-center space-y-1.5 h-full flex flex-col items-center justify-center">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <UserRound size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-xs leading-tight">{t("landing.clientDoorTitle")}</h3>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t("landing.clientDoorDesc")}</p>
                </div>
              </Card>
            </Link>
          </div>

          {/* Debajo de las puertas y no encima: quien llega aquí viene a
              entrar, y esto es lo que se ofrece después de haber entrado. Se
              quita solo cuando ya está instalada o cuando el navegador no
              puede instalarla. */}
          <InstalarApp />

          {/* La única puerta a los dos documentos legales desde fuera. Sin
              esto existen pero no los encuentra nadie, que para la Ley 25 y
              para la revisión de Intuit es lo mismo que no tenerlos. */}
          <div className="flex justify-center gap-4 pt-1 text-[10px] text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">{t("legal.privacyTitle")}</Link>
            <Link href="/terms" className="hover:text-foreground">{t("legal.termsTitle")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
