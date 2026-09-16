/**
 * Activar o quitar el segundo paso al entrar.
 *
 * Vive en Usuarios y roles porque es donde alguien va a pensar en quién entra
 * a este sistema. Es una tarjeta y no una pantalla: la decisión es de una
 * línea —lo quiero o no lo quiero— y el alta entera son dos pasos.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { empezarAlta, terminarAlta, estaPuesto, quitar, type Alta } from "@/lib/dobleFactor";

export function DobleFactor() {
  const { t } = useTranslation();
  const [puesto, setPuesto] = useState<boolean | null>(null);
  const [alta, setAlta] = useState<Alta | null>(null);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    estaPuesto().then(setPuesto);
  }, []);

  const activar = async () => {
    setFallo(null);
    setOcupado(true);
    const r = await empezarAlta();
    setOcupado(false);
    if ("error" in r) return setFallo(t("security.couldNotStart"));
    setAlta(r);
    setCodigo("");
  };

  const confirmar = async (valor: string) => {
    if (!alta || valor.length !== 6) return;
    setFallo(null);
    setOcupado(true);
    const error = await terminarAlta(alta.factorId, valor);
    setOcupado(false);
    if (error) {
      setCodigo("");
      return setFallo(t("security.wrongCode"));
    }
    setAlta(null);
    setPuesto(true);
  };

  const desactivar = async () => {
    setFallo(null);
    setOcupado(true);
    const error = await quitar();
    setOcupado(false);
    if (error) return setFallo(t("security.couldNotRemove"));
    setPuesto(false);
  };

  if (puesto === null) return null;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{t("security.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("security.description")}</p>
        </div>
        {puesto ? (
          <StatusBadge tone="success">{t("security.on")}</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">{t("security.off")}</StatusBadge>
        )}
      </div>

      {/* El alta: el código QR y el campo, juntos. Separarlos en dos pasos
          obliga a soltar el móvil justo cuando lo tiene en la mano. */}
      {alta && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <p className="text-sm text-foreground">{t("security.step1")}</p>
          <img
            src={alta.qr}
            alt={t("security.qrAlt")}
            className="w-44 h-44 bg-white rounded-lg p-2 mx-auto"
          />
          {/* Para quien escanee con el mismo teléfono en el que está mirando
              esto, y no pueda apuntar la cámara a su propia pantalla. */}
          <p className="text-xs text-muted-foreground text-center">
            {t("security.orType")} <code className="select-all break-all">{alta.secreto}</code>
          </p>
          <p className="text-sm text-foreground">{t("security.step2")}</p>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={codigo}
              onChange={(v) => {
                setCodigo(v);
                if (v.length === 6) confirmar(v);
              }}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {ocupado && (
            <p className="text-xs text-muted-foreground text-center inline-flex items-center gap-1.5 w-full justify-center">
              <Spinner className="size-3.5" /> {t("common.loading")}
            </p>
          )}
        </div>
      )}

      {fallo && <p className="text-sm text-status-error-fg">{fallo}</p>}

      <div className="flex flex-wrap gap-2">
        {!puesto && !alta && (
          <Button className="gap-2" onClick={activar} disabled={ocupado}>
            {ocupado ? <Spinner className="size-4" /> : <ShieldCheck size={15} />}
            {t("security.turnOn")}
          </Button>
        )}
        {alta && (
          <Button variant="outline" onClick={() => setAlta(null)} disabled={ocupado}>
            {t("common.cancel")}
          </Button>
        )}
        {puesto && (
          <Button variant="outline" className="gap-2 text-status-error-fg" onClick={desactivar} disabled={ocupado}>
            {ocupado ? <Spinner className="size-4" /> : <ShieldOff size={15} />}
            {t("security.turnOff")}
          </Button>
        )}
      </div>

      {/* La pregunta que viene después de activarlo, contestada antes de que
          la haga: qué pasa si se pierde el móvil. */}
      <p className="text-xs text-muted-foreground">{t("security.lostPhone")}</p>
    </Card>
  );
}
