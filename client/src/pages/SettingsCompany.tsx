import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Check } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";

interface CompanyData {
  id: string;
  name: string;
  licenseNumber: string;
  taxConfig: { region?: string; rate?: number };
}

export default function SettingsCompany() {
  const [reloadToken, setReloadToken] = useState(0);
  const { data, loading, error } = useApi<CompanyData>(`/api/settings/company?_r=${reloadToken}`);
  const [name, setName] = useState("");
  const [license, setLicense] = useState("");
  const [region, setRegion] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setLicense(data.licenseNumber ?? "");
    setRegion(data.taxConfig?.region ?? "");
    setRate(data.taxConfig?.rate ? String(data.taxConfig.rate * 100) : "");
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          licenseNumber: license,
          taxConfig: { region, rate: rate ? Number(rate) / 100 : undefined },
        }),
      });
      setReloadToken((t) => t + 1);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Company Data" description="Datos de la empresa visibles en presupuestos y facturas" />

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
            <Button variant="outline" size="sm">Cambiar logo</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre del negocio</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="license">Número de licencia</Label>
              <Input id="license" value={license} onChange={(e) => setLicense(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="region">Provincia / Estado</Label>
              <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rate">Tasa de impuesto (%)</Label>
              <Input id="rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end">
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
