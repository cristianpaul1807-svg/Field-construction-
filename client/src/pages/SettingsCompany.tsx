import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Check } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface CompanyData {
  id: string;
  name: string;
  slug: string;
  licenseNumber: string;
  taxConfig: { region?: string; rate?: number };
}

export default function SettingsCompany() {
  const { t } = useTranslation();
  const [reloadToken, setReloadToken] = useState(0);
  const { data, loading, error } = useApi<CompanyData>(`/api/settings/company?_r=${reloadToken}`);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [license, setLicense] = useState("");
  const [region, setRegion] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setSlug(data.slug ?? "");
    setLicense(data.licenseNumber ?? "");
    setRegion(data.taxConfig?.region ?? "");
    setRate(data.taxConfig?.rate ? String(data.taxConfig.rate * 100) : "");
  }, [data]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          licenseNumber: license,
          taxConfig: { region, rate: rate ? Number(rate) / 100 : undefined },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "No se pudo guardar");
      }
      setReloadToken((t) => t + 1);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title={t("settings.companyTitle")} description={t("settings.companyDescriptionFull")} />

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

      {!loading && !error && data && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
              {data.name.charAt(0)}
            </div>
            <Button variant="outline" size="sm">{t("settings.changeLogo")}</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("settings.businessName")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="license">{t("settings.licenseNumber")}</Label>
              <Input id="license" value={license} onChange={(e) => setLicense(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="slug">{t("settings.publicLinkAutomations")}</Label>
              <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
              <p className="text-xs text-status-warning-fg">
                Cambiar esto rompe cualquier link que ya hayas compartido — los que tengan el link viejo dejarán
                de poder usarlo.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="region">{t("settings.province")}</Label>
              <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rate">{t("settings.taxRate")}</Label>
              <Input id="rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {saveError && <p className="text-sm text-status-error-fg">{saveError}</p>}
            <Button className="gap-2" onClick={save} disabled={saving}>
              {saved && <Check size={16} />}
              {saved ? "Guardado" : "Guardar cambios"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
