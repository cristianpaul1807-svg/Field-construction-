import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CreditCard, Plus, Trash2, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, readJson, serverMessage, apiEnviar } from "@/lib/api";

export interface Lector {
  id: string;
  nombre: string;
  modelo: string;
  enLinea: boolean;
  accion: { estado: "in_progress" | "succeeded" | "failed"; fallo: string | null; pago: string | null } | null;
}

/**
 * Los lectores de tarjetas del negocio: emparejar uno, ver si está en línea,
 * quitarlo.
 *
 * Emparejar es escribir aquí el código que enseña el aparato. No hay nada que
 * instalar: el lector habla con Stripe por su propia red y el panel sólo le
 * dice qué cobrar.
 */
export function LectoresDeTarjeta({ lectores, onCambio }: { lectores: Lector[]; onCambio: () => void }) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const emparejar = async () => {
    setOcupado(true);
    setFallo(null);
    try {
      const res = await apiFetch("/api/stripe/terminal/lectores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codigo.trim(), nombre: nombre.trim() }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(body, t, t("cobrar.lector.falloAlEmparejar")));
      setCodigo("");
      setNombre("");
      setAbierto(false);
      onCambio();
    } catch (err) {
      setFallo(err instanceof Error ? err.message : t("cobrar.lector.falloAlEmparejar"));
    } finally {
      setOcupado(false);
    }
  };

  const quitar = async (id: string) => {
    if (!window.confirm(t("cobrar.lector.quitarConfirmar"))) return;
    await apiEnviar(`/api/stripe/terminal/lectores/${id}`, { method: "DELETE" });
    onCambio();
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <CreditCard size={20} strokeWidth={1.75} className="text-foreground" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{t("cobrar.lector.titulo")}</h2>
          <p className="text-xs text-muted-foreground">{t("cobrar.lector.descripcion")}</p>
        </div>
      </div>

      {lectores.length > 0 && (
        <ul className="space-y-2">
          {lectores.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{l.nombre}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${l.enLinea ? "bg-status-success-fg" : "bg-muted-foreground"}`} />
                  {l.enLinea ? t("cobrar.lector.enLinea") : t("cobrar.lector.fueraDeLinea")}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-status-error-fg shrink-0"
                aria-label={t("cobrar.lector.quitar")}
                onClick={() => quitar(l.id)}
              >
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!abierto ? (
        <div className="space-y-2">
          <Button variant="outline" className="gap-2" onClick={() => setAbierto(true)}>
            <Plus size={16} /> {t("cobrar.lector.emparejar")}
          </Button>
          {/* Sin lector no hay nada que emparejar, y la pregunta siguiente es
              de dónde sale uno. Se piden desde el propio Stripe del negocio,
              que es donde van a vivir. */}
          {lectores.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("cobrar.lector.dondeComprar")}{" "}
              <a
                href="https://dashboard.stripe.com/terminal/shop"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {t("cobrar.lector.tiendaDeStripe")} <ExternalLink size={12} />
              </a>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">{t("cobrar.lector.comoSacarElCodigo")}</p>
          <div className="space-y-1.5">
            <Label htmlFor="lector-codigo">{t("cobrar.lector.codigo")}</Label>
            <Input
              id="lector-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="sepia-cerulean-aqua"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lector-nombre">{t("cobrar.lector.nombre")}</Label>
            <Input
              id="lector-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t("cobrar.lector.nombreEjemplo")}
            />
          </div>
          {fallo && <p className="text-sm text-status-error-fg">{fallo}</p>}
          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={emparejar} disabled={!codigo.trim() || ocupado}>
              {ocupado && <Spinner className="size-4" />}
              {t("cobrar.lector.emparejarBoton")}
            </Button>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
