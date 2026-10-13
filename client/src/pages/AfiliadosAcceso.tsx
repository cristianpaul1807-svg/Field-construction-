/**
 * La puerta del programa de afiliados: qué es, y apuntarse o entrar.
 *
 * Es la quinta forma de entrar al producto y no se parece a las otras: quien
 * llega aquí no tiene empresa ni es cliente de nadie. Se apunta con correo,
 * contraseña y el código de 8 cifras —el mismo alta que una empresa—, y al
 * terminar ya tiene su enlace. Quien ya tenía cuenta (un contratista que
 * además quiere recomendar) entra y sólo rellena lo que falta.
 *
 * Pública a propósito: es la página que se anuncia.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { DatosDeAfiliado, datosCompletos, type Datos } from "@/components/DatosDeAfiliado";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch, readJson, serverMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { detectarPais, PAIS_POR_DEFECTO } from "@shared/paises";

interface Programa {
  comisionPct: number;
  meses: number;
  diasDeEspera: number;
  minimoCad: number;
}

/** Lo que se promete, si el servidor todavía no ha contestado: lo mismo que él dirá. */
const PROGRAMA_POR_DEFECTO: Programa = { comisionPct: 30, meses: 12, diasDeEspera: 30, minimoCad: 50 };

function paisDelAparato(): string {
  try {
    return detectarPais(Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.languages ?? []) ?? PAIS_POR_DEFECTO;
  } catch {
    return PAIS_POR_DEFECTO;
  }
}

export default function AfiliadosAcceso() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { session, persona, loading, refreshPersona, signOut } = useAuth();
  const [programa, setPrograma] = useState<Programa>(PROGRAMA_POR_DEFECTO);
  const [modo, setModo] = useState<"alta" | "entrar">("alta");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [datos, setDatos] = useState<Datos>({ nombre: "", dondeComparte: "", pais: paisDelAparato(), firmaNombre: "", firmaImagen: null, acepta: false });
  const [pideCodigo, setPideCodigo] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/public/afiliados/programa")
      .then((r) => (r.ok ? readJson<Programa>(r) : null))
      .then((p) => p && setPrograma(p))
      .catch(() => {});
  }, []);

  // Ya es afiliado: a su panel.
  useEffect(() => {
    if (!loading && session && persona === "affiliate") setLocation("/afiliados/panel");
  }, [loading, session, persona, setLocation]);

  /** El último paso, el mismo para un alta nueva y para quien ya tenía cuenta. */
  const apuntarse = async () => {
    const res = await apiFetch("/api/afiliados/alta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: datos.nombre,
        dondeComparte: datos.dondeComparte,
        pais: datos.pais,
        idioma: i18n.language.slice(0, 2),
        aceptaCondiciones: datos.acepta,
        firmaNombre: datos.firmaNombre,
        firmaImagen: datos.firmaImagen,
      }),
    });
    if (!res.ok) throw new Error(serverMessage(await readJson(res), t, t("auth.somethingWentWrong")));
    await refreshPersona();
    setLocation("/afiliados/panel");
  };

  const crearCuenta = async () => {
    setError(null);
    setBusy(true);
    try {
      if (session) await signOut();
      const { data, error: fallo } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { lang: i18n.language.slice(0, 2) } },
      });
      const yaExiste = (m: string) => /already|registered|exists|in use/i.test(m);
      if (fallo) {
        if (yaExiste(fallo.message)) {
          setError(t("auth.emailAlreadyInUse"));
          return;
        }
        throw fallo;
      }
      // Supabase contesta así a un correo ya registrado, sin error.
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError(t("auth.emailAlreadyInUse"));
        return;
      }
      if (data?.session) await supabase.auth.signOut();
      setPideCodigo(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  };

  const verificar = async () => {
    setError(null);
    setBusy(true);
    try {
      let r = await supabase.auth.verifyOtp({ email, token: codigo, type: "signup" });
      if (r.error) r = await supabase.auth.verifyOtp({ email, token: codigo, type: "email" });
      if (r.error) throw r.error;
      if (!r.data.session) throw new Error(t("auth.invalidOrExpiredCode"));
      if (password) await supabase.auth.updateUser({ password }).catch(() => null);
      await apuntarse();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.invalidOrExpiredCode"));
    } finally {
      setBusy(false);
    }
  };

  const entrar = async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: fallo } = await supabase.auth.signInWithPassword({ email, password });
      if (fallo) throw fallo;
      await refreshPersona();
      const res = await apiFetch("/api/afiliados/panel");
      if (res.ok) {
        setLocation("/afiliados/panel");
        return;
      }
      // Tiene cuenta pero no es afiliado: se queda aquí, con el formulario de
      // unirse (lo pinta `session && persona !== "affiliate"`).
      const cuerpo = await readJson<{ code?: string }>(res);
      if (cuerpo?.code !== "no_es_afiliado") throw new Error(serverMessage(cuerpo, t, t("auth.somethingWentWrong")));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.wrongCredentials"));
    } finally {
      setBusy(false);
    }
  };

  const unirse = async () => {
    setError(null);
    setBusy(true);
    try {
      await apuntarse();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  };

  const yaTieneCuenta = !loading && session && persona !== "affiliate" && !pideCodigo;

  return (
    <div className="min-h-screen bg-background px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex items-center justify-between py-2">
          <Logo size={36} />
          <LanguageSwitcher />
        </div>

        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("afiliados.titulo")}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("afiliados.lema", { pct: programa.comisionPct, meses: programa.meses })}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("afiliados.explicacion", { pct: programa.comisionPct, meses: programa.meses })}
          </p>
          <ol className="space-y-1.5 pt-1 text-sm text-foreground">
            {[t("afiliados.paso1"), t("afiliados.paso2"), t("afiliados.paso3", { minimo: programa.minimoCad })].map((paso, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span>{paso}</span>
              </li>
            ))}
          </ol>
        </header>

        <Card className="p-5">
          {yaTieneCuenta ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                unirse();
              }}
            >
              <div>
                <h2 className="font-semibold text-foreground">{t("afiliados.unirmeTitulo")}</h2>
                <p className="text-sm text-muted-foreground">{t("afiliados.unirmeTexto")}</p>
              </div>
              <DatosDeAfiliado datos={datos} onCambio={setDatos} />
              {error && <p className="text-sm text-status-error-fg">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy || !datosCompletos(datos)}>
                {t("afiliados.firmarYRecibir")}
              </Button>
            </form>
          ) : pideCodigo ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                verificar();
              }}
            >
              <div className="space-y-1 text-center">
                <h2 className="font-semibold text-foreground">{t("auth.verifyYourEmail")}</h2>
                <p className="text-sm text-muted-foreground">{t("auth.codeSentTo", { email })}</p>
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={8} value={codigo} onChange={setCodigo}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error && <p className="text-center text-sm text-status-error-fg">{error}</p>}
              <Button type="submit" className="w-full" disabled={codigo.length !== 8 || busy}>
                {t("auth.verifyCode")}
              </Button>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (modo === "alta") crearCuenta();
                else entrar();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="afiliado-email">{t("common.email")}</Label>
                <Input id="afiliado-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="afiliado-clave">{t("auth.password")}</Label>
                <Input
                  id="afiliado-clave"
                  type="password"
                  autoComplete={modo === "alta" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {modo === "alta" && <DatosDeAfiliado datos={datos} onCambio={setDatos} />}
              {error && <p className="text-sm text-status-error-fg">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={busy || !email || !password || (modo === "alta" && !datosCompletos(datos))}
              >
                {modo === "alta" ? t("afiliados.firmarYRecibir") : t("afiliados.entrar")}
              </Button>
            </form>
          )}
        </Card>

        {!pideCodigo && !yaTieneCuenta && (
          <p className="text-center text-sm text-muted-foreground">
            {modo === "alta" ? t("afiliados.yaSoy") : t("afiliados.todaviaNo")}{" "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                setModo(modo === "alta" ? "entrar" : "alta");
                setError(null);
              }}
            >
              {modo === "alta" ? t("afiliados.entrar") : t("afiliados.crearCuenta")}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
