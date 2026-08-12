import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface MarginSettings {
  defaultMarginType: "global" | "section";
  defaultWastePercent: number;
}

export default function SettingsMargins() {
  const { t } = useTranslation();
  const { data, loading, error } = useApi<MarginSettings>("/api/settings/margins");
  const [marginType, setMarginType] = useState<"global" | "section">("global");
  const [waste, setWaste] = useState(0);

  useEffect(() => {
    if (!data) return;
    setMarginType(data.defaultMarginType);
    setWaste(data.defaultWastePercent);
  }, [data]);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title={t("settings.marginsTitle")} description={t("settings.marginsDescriptionFull")} />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Cargando...
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          No se pudo cargar desde Supabase: {error}
        </div>
      )}

      {!loading && !error && (
        <Card className="p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-foreground mb-2">{t("settings.defaultMarginType")}</p>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm max-w-xs">
              <button
                onClick={() => setMarginType("global")}
                className={`flex-1 py-1.5 transition-colors ${marginType === "global" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"}`}
              >
                Global
              </button>
              <button
                onClick={() => setMarginType("section")}
                className={`flex-1 py-1.5 transition-colors ${marginType === "section" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"}`}
              >
                Por sección
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Determina si el margen se aplica a todo el presupuesto o se puede ajustar zona por zona.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <p className="font-medium text-foreground">{t("settings.defaultWaste")}</p>
              <span className="text-muted-foreground">{waste}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={25}
              value={waste}
              onChange={(e) => setWaste(Number(e.target.value))}
              className="w-full max-w-xs accent-primary"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Se aplica automáticamente al crear un nuevo presupuesto; editable por presupuesto.
            </p>
          </div>

          <div className="flex justify-end">
            <Button>{t("settings.saveChanges")}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
