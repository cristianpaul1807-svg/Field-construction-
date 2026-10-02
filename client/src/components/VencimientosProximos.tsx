import { useTranslation } from "react-i18next";
import { CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useApi } from "@/lib/api";
import { Caducidad } from "@/components/PapelesDeLaPersona";

interface Vencimiento {
  id: string;
  kind: string;
  name: string;
  expiresOn: string;
  daysLeft: number;
  personKind: "employee" | "subcontractor";
  personName: string | null;
}

/**
 * Lo que vence pronto, de todo el equipo a la vez.
 *
 * Abrir los papeles de cada persona para ver si a alguien se le acaba el
 * curso de seguridad es justo lo que nadie hace hasta que llega la
 * inspección. Aquí sale sólo lo vencido y lo que vence este mes, y si no hay
 * nada, no sale nada: una tarjeta que dice «todo bien» cada día se deja de
 * mirar, y entonces tampoco se ve el día que no.
 *
 * Los papeles son del área de personas. Quien no la tiene recibe un 403 y la
 * tarjeta simplemente no aparece.
 */
export function VencimientosProximos({ solo }: { solo?: "employee" | "subcontractor" }) {
  const { t, i18n } = useTranslation();
  const { data } = useApi<Vencimiento[]>("/api/worker-documents/expiring");
  const hoy = new Date().toISOString().slice(0, 10);
  const lista = (data ?? []).filter((v) => !solo || v.personKind === solo);
  if (lista.length === 0) return null;

  return (
    <Card className="p-4 space-y-2 border-status-warning-fg/30">
      <p className="text-sm font-medium text-foreground inline-flex items-center gap-2">
        <CalendarClock size={15} strokeWidth={1.75} className="text-status-warning-fg shrink-0" />
        {t("workerDocs.expiringTitle", { count: lista.length })}
      </p>
      <ul className="divide-y divide-border">
        {lista.map((v) => (
          <li key={v.id} className="py-1.5 min-w-0">
            <p className="text-sm text-foreground break-words">
              {v.personName} · {t(`workerDocs.kinds.${v.kind}`, { defaultValue: v.kind })}
            </p>
            <Caducidad fecha={v.expiresOn} hoy={hoy} idioma={i18n.language} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
