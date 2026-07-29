import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Search, Send } from "lucide-react";
import { materialsCatalog, formatCurrency } from "@/lib/mockData";

export default function Materials() {
  const [query, setQuery] = useState("");
  const filtered = materialsCatalog.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Materials & Costs"
        description="Catálogo maestro de materiales, mano de obra y subcontratistas del negocio"
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Plus size={16} /> New Material
          </Button>
        }
      />

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-muted-foreground" />
            <Input placeholder="Buscar material..." value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Send size={14} /> Exportar solicitud de precios a proveedores
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Nombre</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Categoría</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Unidad</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Proveedor</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Precio</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((material) => (
                <tr key={material.id} className="border-b border-border last:border-0 hover:bg-secondary transition-colors">
                  <td className="py-3 text-foreground font-medium">{material.name}</td>
                  <td className="py-3 text-muted-foreground">{material.category}</td>
                  <td className="py-3 text-muted-foreground">{material.unit}</td>
                  <td className="py-3 text-muted-foreground">{material.supplier}</td>
                  <td className="py-3 text-right">
                    {material.isReferenceOnly ? (
                      <StatusBadge tone="neutral">Solo referencia</StatusBadge>
                    ) : (
                      <span className="text-foreground">{formatCurrency(material.price ?? 0)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Conexión opcional a futuro con catálogos de proveedores (Home Depot Pro, RONA) para
        autoactualizar precios — no es prioridad de v1.
      </p>
    </div>
  );
}
