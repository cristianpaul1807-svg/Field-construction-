import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { business } from "@/lib/mockData";

export default function SettingsCompany() {
  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Company Data" description="Datos de la empresa visibles en presupuestos y facturas" />

      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
            {business.name.charAt(0)}
          </div>
          <Button variant="outline" size="sm">Cambiar logo</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre del negocio</Label>
            <Input id="name" defaultValue={business.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="license">Número de licencia</Label>
            <Input id="license" defaultValue={business.licenseNumber} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="region">Provincia / Estado</Label>
            <Input id="region" defaultValue={business.taxConfig.region} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate">Tasa de impuesto</Label>
            <Input id="rate" defaultValue={`${(business.taxConfig.rate * 100).toFixed(0)}%`} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button>Guardar cambios</Button>
        </div>
      </Card>
    </div>
  );
}
