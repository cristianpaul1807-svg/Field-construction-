import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Search, Send } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useApi } from "@/lib/api";

interface MaterialRow {
  id: string;
  name: string;
  unit: string;
  price: number | null;
  category: string | null;
  supplier: string | null;
  isReferenceOnly: boolean;
}

interface MaterialsResponse {
  materials: MaterialRow[];
  laborRates: { id: string; name: string; hourlyRate: number }[];
  subcontractors: { id: string; name: string; trade: string | null; rating: number | null }[];
}

export default function Materials() {
  const { data, loading, error } = useApi<MaterialsResponse>("/api/materials");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    if (!data) return [];
    const materialRows = data.materials.map((m) => ({
      key: `material-${m.id}`,
      name: m.name,
      category: m.category ?? "Materiales",
      unit: m.unit,
      supplier: m.supplier ?? "—",
      price: m.isReferenceOnly ? null : m.price,
    }));
    const laborRows = data.laborRates.map((l) => ({
      key: `labor-${l.id}`,
      name: l.name,
      category: "Mano de obra",
      unit: "hora",
      supplier: "—",
      price: l.hourlyRate,
    }));
    const subRows = data.subcontractors.map((s) => ({
      key: `sub-${s.id}`,
      name: s.name,
      category: "Subcontratistas",
      unit: "servicio",
      supplier: s.trade ?? "—",
      price: null as number | null,
    }));
    return [...materialRows, ...laborRows, ...subRows].filter((r) =>
      r.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [data, query]);

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

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Cargando catálogo...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
            No se pudo cargar el catálogo real: {error}
          </div>
        )}

        {!loading && !error && (
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
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-border last:border-0 hover:bg-secondary transition-colors">
                    <td className="py-3 text-foreground font-medium">{row.name}</td>
                    <td className="py-3 text-muted-foreground">{row.category}</td>
                    <td className="py-3 text-muted-foreground">{row.unit}</td>
                    <td className="py-3 text-muted-foreground">{row.supplier}</td>
                    <td className="py-3 text-right">
                      {row.price === null ? (
                        <StatusBadge tone="neutral">
                          {row.category === "Subcontratistas" ? "Cotiza por proyecto" : "Solo referencia"}
                        </StatusBadge>
                      ) : (
                        <span className="text-foreground">{formatCurrency(row.price)}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No se encontraron materiales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Conexión opcional a futuro con catálogos de proveedores (Home Depot Pro, RONA) para
        autoactualizar precios — no es prioridad de v1.
      </p>
    </div>
  );
}
