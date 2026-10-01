import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiEnviar } from "@/lib/api";
import { BONUS_FISCALI, type BonusFiscale } from "@shared/bonusEdilizi";

/**
 * Si el cliente deduce esta obra, y con qué bonus.
 *
 * Se marca una vez en la obra y de ahí sale todo lo demás: el texto del
 * bonifico parlante en sus facturas y en su portal, y la cuenta de lo que el
 * banco le va a retener a la impresa. Sin marcarlo, el cliente paga con una
 * transferencia normal y pierde la deducción.
 */
export function BonusDeLaObra({ projectId, valor, onCambio }: { projectId: string; valor: BonusFiscale | null; onCambio: () => void }) {
  const { t } = useTranslation();
  const [guardando, setGuardando] = useState(false);

  const cambiar = async (nuevo: string) => {
    setGuardando(true);
    try {
      await apiEnviar(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bonusFiscale: nuevo === "ninguno" ? null : nuevo }),
      });
      onCambio();
    } catch {
      // apiEnviar ya ha avisado.
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Landmark size={15} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
        <p className="text-sm font-medium text-foreground">{t("bonus.title")}</p>
      </div>
      <Select value={valor ?? "ninguno"} onValueChange={(v) => void cambiar(v)} disabled={guardando}>
        <SelectTrigger className="min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ninguno">{t("bonus.none")}</SelectItem>
          {BONUS_FISCALI.map((b) => (
            <SelectItem key={b} value={b}>{t(`bonus.kind.${b}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t(valor ? "bonus.hintOn" : "bonus.hintOff")}</p>
    </Card>
  );
}
