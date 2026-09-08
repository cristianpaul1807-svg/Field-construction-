import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { UserPlus, ArrowRight } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";

/**
 * Ponerle dueño a una propuesta que se hizo en frío.
 *
 * El contratista presenta propuestas antes de que exista ningún cliente: ha
 * visto una obra, deja un número, y si la cosa cuaja entonces da de alta al
 * interesado. Este control es la segunda mitad de eso — engancha el
 * presupuesto que ya existe al cliente recién creado, en vez de obligar a
 * rehacerlo desde cero.
 */
interface Client {
  id: string;
  name: string;
}

export function AssignClientControl({
  estimateId,
  onAssigned,
}: {
  estimateId: string;
  onAssigned: () => void;
}) {
  const { t } = useTranslation();
  const { data: clients } = useApi<Client[]>("/api/clients");
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasClients = (clients ?? []).length > 0;

  const assign = async () => {
    if (!choice) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/estimates/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: choice }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || t("common.saveError"));
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.saveError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-2.5">
      <p className="text-xs text-muted-foreground">{t("budgets.unassignedHint")}</p>

      {hasClients ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger className="w-full sm:w-56 h-8 text-sm">
              <SelectValue placeholder={t("common.selectClient")} />
            </SelectTrigger>
            <SelectContent>
              {(clients ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={assign} disabled={!choice || busy} className="gap-1.5">
            {busy && <Spinner className="size-3.5" />}
            {t("budgets.assignClient")}
          </Button>
        </div>
      ) : (
        // Sin nadie en el CRM todavía, lo único que sirve es ir a crearlo.
        <Link href="/crm">
          <Button size="sm" variant="outline" className="gap-1.5">
            <UserPlus size={14} strokeWidth={1.75} /> {t("common.goCreateClient")} <ArrowRight size={13} />
          </Button>
        </Link>
      )}

      {error && <p className="text-xs text-status-error-fg">{error}</p>}
    </div>
  );
}
