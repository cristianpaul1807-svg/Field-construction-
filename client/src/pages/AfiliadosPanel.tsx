/**
 * El panel del afiliado: su enlace, lo que lleva ganado y cómo cobrarlo.
 *
 * Todo sale de `/api/afiliados/panel`, que calcula las cuentas a partir de
 * las comisiones (ver server/afiliados.ts). Aquí no se suma nada: lo que el
 * afiliado ve es exactamente lo que el servidor le pagaría.
 *
 * Sin nombres de las empresas que trajo: son clientes nuestros, y su nombre
 * es suyo. Ve cuántas, en qué estado, y cuánto le han generado.
 */
import { useCallback, useEffect, useState } from "react";
import { Redirect, Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink, LogOut, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { SelectorDePais } from "@/components/SelectorDePais";
import { apiFetch, readJson, serverMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PAIS_POR_DEFECTO } from "@shared/paises";

interface Panel {
  codigo: string;
  nombre: string;
  estado: "activo" | "suspendido" | "cancelado";
  comisionPct: number;
  meses: number;
  diasDeEspera: number;
  minimoCad: number;
  pais: string | null;
  stripeConectado: boolean;
  clientes: { total: number; enPrueba: number; pagando: number };
  enEsperaCad: number;
  disponibleCad: number;
  pagadoCad: number;
  ultimasComisiones: { periodo: string; importeCad: number; estado: "en_espera" | "disponible" | "pagada" | "anulada"; disponibleEn: string }[];
  pagos: { importeCad: number; estado: "enviando" | "enviado" | "fallido"; fecha: string }[];
}

const CANAL = "https://www.youtube.com/@LogicielConstruction";

function Cifra({ que, valor, pista }: { que: string; valor: string; pista?: string }) {
  return (
    // En dos columnas de un móvil de 320 px, «98 765,43 $» en grande no cabe:
    // más pequeño en el teléfono, y partible si aun así no entra.
    <Card className="min-w-0 p-4">
      <p className="break-words text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{valor}</p>
      <p className="mt-1 text-sm text-muted-foreground">{que}</p>
      {pista && <p className="mt-1 text-xs text-muted-foreground">{pista}</p>}
    </Card>
  );
}

function Copiable({ texto, multilinea = false }: { texto: string; multilinea?: boolean }) {
  const { t } = useTranslation();
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1600);
    } catch {
      // Sin permiso para el portapapeles: el texto sigue ahí para copiarlo a mano.
    }
  };
  return (
    <div className="flex items-start gap-2">
      <p className={`min-w-0 flex-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground ${multilinea ? "whitespace-pre-wrap" : "truncate font-mono"}`}>
        {texto}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={copiar} className="shrink-0 gap-1.5">
        {copiado ? <Check size={14} /> : <Copy size={14} />}
        {copiado ? t("afiliados.copiado") : t("afiliados.copiar")}
      </Button>
    </div>
  );
}

export default function AfiliadosPanel() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { session, loading: cargandoSesion, signOut } = useAuth();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noEsAfiliado, setNoEsAfiliado] = useState(false);
  const [paisCobro, setPaisCobro] = useState(PAIS_POR_DEFECTO);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const dinero = (valor: number) => new Intl.NumberFormat(i18n.language, { style: "currency", currency: "CAD" }).format(valor);
  const fecha = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" });

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/afiliados/panel");
    const cuerpo = await readJson(res);
    if (!res.ok) {
      if (cuerpo?.code === "no_es_afiliado") setNoEsAfiliado(true);
      else setError(serverMessage(cuerpo, t, t("auth.somethingWentWrong")));
      return;
    }
    setPanel(cuerpo as Panel);
    if ((cuerpo as Panel).pais) setPaisCobro((cuerpo as Panel).pais!);
  }, [t]);

  useEffect(() => {
    if (session) cargar();
  }, [session, cargar]);

  if (cargandoSesion) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }
  if (!session || noEsAfiliado) return <Redirect to="/afiliados" />;

  const enlace = panel ? `${window.location.origin}/?ref=${panel.codigo}` : "";

  const conectar = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/afiliados/cobro/enlace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pais: paisCobro }),
      });
      const cuerpo = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(cuerpo, t, t("auth.somethingWentWrong")));
      window.location.href = cuerpo.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.somethingWentWrong"));
      setBusy(false);
    }
  };

  const retirar = async () => {
    setBusy(true);
    setError(null);
    setAviso(null);
    try {
      const res = await apiFetch("/api/afiliados/retirar", { method: "POST" });
      const cuerpo = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(cuerpo, t, t("auth.somethingWentWrong")));
      setAviso(t("afiliados.retirado", { importe: dinero(cuerpo.importeCad) }));
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-3 py-2">
          <Logo size={36} />
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={async () => {
                await signOut();
                setLocation("/afiliados");
              }}
            >
              <LogOut size={14} /> {t("afiliados.salir")}
            </Button>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("afiliados.panelTitulo")}</h1>

        {error && <p className="rounded-md border border-border bg-status-error-bg/40 p-3 text-sm text-status-error-fg">{error}</p>}
        {aviso && <p className="rounded-md border border-border bg-status-success-bg/40 p-3 text-sm text-status-success-fg">{aviso}</p>}

        {!panel ? (
          !error && (
            <div className="flex justify-center py-12">
              <Spinner className="size-5" />
            </div>
          )
        ) : (
          <>
            {panel.estado !== "activo" && (
              <p className="rounded-md border border-border bg-status-warning-bg/40 p-3 text-sm text-status-warning-fg">{t("afiliados.suspendido")}</p>
            )}

            <Card className="space-y-3 p-5">
              <Label>{t("afiliados.tuEnlace")}</Label>
              <Copiable texto={enlace} />
              <p className="text-xs text-muted-foreground">{t("afiliados.enlacePista", { pct: panel.comisionPct, meses: panel.meses })}</p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Cifra
                que={t("afiliados.clientes")}
                valor={String(panel.clientes.total)}
                pista={t("afiliados.clientesDetalle", { prueba: panel.clientes.enPrueba, pagando: panel.clientes.pagando })}
              />
              <Cifra que={t("afiliados.enEspera")} valor={dinero(panel.enEsperaCad)} pista={t("afiliados.enEsperaPista", { dias: panel.diasDeEspera })} />
              <Cifra que={t("afiliados.disponible")} valor={dinero(panel.disponibleCad)} />
              <Cifra que={t("afiliados.pagado")} valor={dinero(panel.pagadoCad)} />
            </div>

            <Card className="space-y-3 p-5">
              <h2 className="font-semibold text-foreground">{t("afiliados.cobroTitulo")}</h2>
              {!panel.stripeConectado ? (
                <>
                  <p className="text-sm text-muted-foreground">{t("afiliados.cobroSinCuenta")}</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="pais-cobro">{t("afiliados.cobroPais")}</Label>
                    <SelectorDePais id="pais-cobro" valor={paisCobro} onCambio={setPaisCobro} />
                  </div>
                  <Button onClick={conectar} disabled={busy} className="h-auto gap-1.5 whitespace-normal py-2">
                    <ExternalLink size={14} /> {t("afiliados.conectar")}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t("afiliados.cobroConectado")}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button className="h-auto whitespace-normal py-2" onClick={retirar} disabled={busy || panel.disponibleCad < panel.minimoCad || panel.estado !== "activo"}>
                      {t("afiliados.retirar", { importe: dinero(panel.disponibleCad) })}
                    </Button>
                    <Button variant="outline" onClick={conectar} disabled={busy} className="h-auto gap-1.5 whitespace-normal py-2">
                      <ExternalLink size={14} /> {t("afiliados.completarStripe")}
                    </Button>
                  </div>
                </>
              )}
              <p className="text-xs text-muted-foreground">{t("afiliados.minimo", { minimo: panel.minimoCad })}</p>
            </Card>

            <Card className="space-y-3 p-5">
              <h2 className="font-semibold text-foreground">{t("afiliados.contenido")}</h2>
              <p className="text-sm text-muted-foreground">{t("afiliados.contenidoTexto")}</p>
              <a href={CANAL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <PlayCircle size={16} /> {t("afiliados.verCanal")}
              </a>
              <Label className="block pt-2">{t("afiliados.mensajeListo")}</Label>
              <Copiable texto={t("afiliados.mensaje", { enlace })} multilinea />
            </Card>

            <Card className="space-y-3 p-5">
              <h2 className="font-semibold text-foreground">{t("afiliados.comisiones")}</h2>
              {panel.ultimasComisiones.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("afiliados.sinComisiones")}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {panel.ultimasComisiones.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="text-foreground">{fecha(c.periodo)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t(`afiliados.estado.${c.estado}`, { fecha: fecha(c.disponibleEn) })}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums font-medium text-foreground">{dinero(c.importeCad)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {panel.pagos.length > 0 && (
                <>
                  <h3 className="pt-2 text-sm font-semibold text-foreground">{t("afiliados.pagos")}</h3>
                  <ul className="divide-y divide-border">
                    {panel.pagos.map((p, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span>
                          {fecha(p.fecha)} · <span className="text-muted-foreground">{t(`afiliados.pagoEstado.${p.estado}`)}</span>
                        </span>
                        <span className="tabular-nums font-medium text-foreground">{dinero(p.importeCad)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <p className="text-center text-xs text-muted-foreground">
              <Link href="/afiliados/condiciones" className="hover:text-foreground underline underline-offset-2">
                {t("afiliados.verCondiciones")}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
