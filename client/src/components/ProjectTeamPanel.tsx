import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { X, UserPlus } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";

/**
 * Quién trabaja en esta obra.
 *
 * Esto era sólo un listado. El equipo únicamente se llenaba desde la
 * proyección de trabajo de un presupuesto, así que una obra creada al aceptar
 * un presupuesto normal nacía sin nadie y no había manera de poner a nadie.
 *
 * Y no era un detalle de esta pantalla: el trabajador sólo ve en su móvil las
 * obras a las que está enganchado. Sin equipo, abría la aplicación, no
 * encontraba ninguna obra, y no podía fichar. De ahí cuelgan las horas, las
 * extra, la nómina y el coste de mano de obra.
 */
export interface TeamMember {
  id: string;
  name: string;
  kind: "employee" | "subcontractor";
}

interface Person {
  id: string;
  name: string;
}

export function ProjectTeamPanel({
  projectId,
  team,
  onChanged,
}: {
  projectId: string;
  team: TeamMember[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { data: employees } = useApi<Person[]>("/api/employees");
  const { data: subs } = useApi<Person[]>("/api/subcontractors");
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un solo desplegable con las dos plantillas: al que asigna le da igual el
  // contrato que tenga cada uno, quiere poner gente en la obra.
  const options = [
    ...(employees ?? []).map((e) => ({ value: `employee:${e.id}`, name: e.name })),
    ...(subs ?? []).map((s) => ({ value: `subcontractor:${s.id}`, name: s.name })),
  ].filter((o) => !team.some((m) => m.name === o.name));

  const send = async (fn: () => Promise<Response>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || t("common.saveError"));
      setChoice("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    if (!choice) return;
    const [kind, id] = choice.split(":");
    return send(() =>
      apiFetch(`/api/projects/${projectId}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "employee" ? { employeeId: id } : { subcontractorId: id }),
      })
    );
  };

  const remove = (assignmentId: string) =>
    send(() => apiFetch(`/api/projects/${projectId}/team/${assignmentId}`, { method: "DELETE" }));

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-foreground mb-1 text-sm">{t("projects.assignedTeam")}</h3>
      {/* Lo que está en juego, dicho donde se decide: sin equipo nadie ficha. */}
      <p className="text-xs text-muted-foreground mb-3">{t("projects.teamEnablesClockIn")}</p>

      <div className="space-y-2">
        {team.map((member) => (
          <div key={member.id} className="flex items-center gap-2 text-sm text-foreground group">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {member.name.charAt(0)}
            </div>
            <span className="flex-1 truncate">{member.name}</span>
            <button
              onClick={() => remove(member.id)}
              disabled={busy}
              aria-label={t("common.delete")}
              className="text-muted-foreground hover:text-status-error-fg transition-colors"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
        {team.length === 0 && <p className="text-xs text-muted-foreground">{t("projects.noTeamYet")}</p>}
      </div>

      <div className="flex items-center gap-2 mt-4">
        {options.length > 0 ? (
          <>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue placeholder={t("projects.pickWorker")} />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={add} disabled={!choice || busy} className="gap-1.5">
              {busy ? <Spinner className="size-3.5" /> : <UserPlus size={14} strokeWidth={1.75} />}
              {t("projects.addToTeam")}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {(employees ?? []).length + (subs ?? []).length === 0
              ? t("projects.hireSomeoneFirst")
              : t("projects.everyoneAssigned")}
          </p>
        )}
      </div>

      {error && <p className="text-xs text-status-error-fg mt-2">{error}</p>}
    </Card>
  );
}
