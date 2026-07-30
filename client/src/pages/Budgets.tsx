import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useApi } from "@/lib/api";
import { WorkProjectionPanel } from "@/components/WorkProjectionPanel";
import { BudgetCategoriesPanel } from "@/components/BudgetCategoriesPanel";

interface EstimateSummary {
  id: string;
  clientName: string | null;
  status: string;
  total: number;
  createdAt: string;
}

interface BudgetCategory {
  id: string;
  name: string;
}

interface EstimateLine {
  id: string;
  zone: string;
  category: "Materiales" | "Mano de obra" | "Subcontratistas";
  item: string;
  quantity: number;
  unitCost: number;
  visibleToClient: boolean;
}

interface EstimateDetail {
  id: string;
  clientName: string | null;
  clientAddress: string | null;
  status: string;
  createdBy: string;
  categoryId: string | null;
  categoryName: string | null;
  marginType: "global" | "section";
  marginPercent: number;
  wastePercent: number;
  createdAt: string;
  lines: EstimateLine[];
}

interface AssemblyTemplate {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  laborHours: number;
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
      No se pudo cargar desde Supabase: {message}
    </div>
  );
}

export default function Budgets() {
  const [reloadToken, setReloadToken] = useState(0);
  const { data: summaries, loading: summariesLoading, error: summariesError } =
    useApi<EstimateSummary[]>(`/api/estimates?_r=${reloadToken}`);
  const draftId = summaries && summaries.length > 0 ? summaries[0].id : null;
  const { data: draft, loading: draftLoading, error: draftError } =
    useApi<EstimateDetail>(draftId ? `/api/estimates/${draftId}?_r=${reloadToken}` : null);
  const { data: assemblyTemplates, loading: templatesLoading, error: templatesError } =
    useApi<AssemblyTemplate[]>("/api/assembly-templates");
  const { data: categories } = useApi<BudgetCategory[]>(`/api/budget-categories?_r=${reloadToken}`);

  const setCategory = async (categoryId: string) => {
    if (!draftId) return;
    await fetch(`/api/estimates/${draftId}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
    setReloadToken((t) => t + 1);
  };

  const [marginType, setMarginType] = useState<"global" | "section">("global");
  const [marginPercent, setMarginPercent] = useState(0);
  const [wastePercent, setWastePercent] = useState(0);
  const [visibility, setVisibility] = useState<boolean[]>([]);
  const [pdfOpen, setPdfOpen] = useState(false);

  // Sync locally-editable state whenever a new draft loads.
  useEffect(() => {
    if (!draft) return;
    setMarginType(draft.marginType);
    setMarginPercent(draft.marginPercent);
    setWastePercent(draft.wastePercent);
    setVisibility(draft.lines.map((l) => l.visibleToClient));
  }, [draft]);

  const loading = summariesLoading || draftLoading;
  const error = summariesError || draftError;

  const lines = draft?.lines ?? [];
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
  const wasteAmount = subtotal * (wastePercent / 100);
  const marginAmount = (subtotal + wasteAmount) * (marginPercent / 100);
  const total = subtotal + wasteAmount + marginAmount;
  const zones = Array.from(new Set(lines.map((l) => l.zone)));

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Budgets & Estimates"
        description="Constructor de presupuestos con jerarquía Zona → Categoría → Ítem"
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Plus size={16} /> New Budget
          </Button>
        }
      />

      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">Presupuesto</TabsTrigger>
          <TabsTrigger value="templates">Assembly Templates</TabsTrigger>
          <TabsTrigger value="categorias">Categorías y referencias</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="mt-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Spinner className="size-4" /> Cargando presupuesto...
            </div>
          )}
          {error && <ErrorNote message={error} />}
          {!loading && !error && !draft && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Este negocio todavía no tiene presupuestos.
            </p>
          )}

          {!loading && !error && draft && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-semibold text-foreground">
                        Presupuesto #{draft.id.slice(0, 8).toUpperCase()}
                      </h2>
                      <p className="text-xs text-muted-foreground">{draft.clientName} · borrador en curso</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={draft.categoryId ?? undefined} onValueChange={setCategory}>
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue placeholder="Sin categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {(categories ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <StatusBadge tone="info">{draft.status}</StatusBadge>
                    </div>
                  </div>

                  {zones.map((zone) => (
                    <div key={zone} className="border border-border rounded-lg p-4 mb-4 last:mb-0">
                      <h3 className="font-medium text-foreground mb-3">Zona: {zone}</h3>
                      {["Materiales", "Mano de obra", "Subcontratistas"].map((category) => {
                        const zoneLines = lines
                          .map((line, idx) => ({ line, idx }))
                          .filter(({ line }) => line.zone === zone && line.category === category);
                        if (zoneLines.length === 0) return null;
                        return (
                          <div key={category} className="mb-3 pl-4 border-l-2 border-primary/40 last:mb-0">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{category}</h4>
                            <div className="space-y-2">
                              {zoneLines.map(({ line, idx }) => (
                                <div key={line.id} className="flex items-center justify-between gap-3 text-sm">
                                  <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                                    <Checkbox
                                      checked={visibility[idx]}
                                      onCheckedChange={(checked) =>
                                        setVisibility((prev) => prev.map((v, i) => (i === idx ? checked === true : v)))
                                      }
                                    />
                                    <span className="text-muted-foreground truncate">{line.item}</span>
                                  </label>
                                  <span className="text-foreground flex-shrink-0">{formatCurrency(line.quantity * line.unitCost)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2">
                    El check junto a cada línea controla su visibilidad en el Client Portal (visible_to_client).
                  </p>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="p-4">
                  <h3 className="font-semibold text-foreground mb-3 text-sm">Margen y merma</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Tipo de margen</p>
                      <div className="flex rounded-lg border border-border overflow-hidden text-sm">
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
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Margen</span>
                        <span>{marginPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        value={marginPercent}
                        onChange={(e) => setMarginPercent(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Factor de merma</span>
                        <span>{wastePercent}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={25}
                        value={wastePercent}
                        onChange={(e) => setWastePercent(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Merma ({wastePercent}%)</span>
                    <span className="text-foreground">{formatCurrency(wasteAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Margen ({marginPercent}%)</span>
                    <span className="text-foreground">{formatCurrency(marginAmount)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                    <span className="text-foreground">Total</span>
                    <span className="text-foreground">{formatCurrency(total)}</span>
                  </div>
                </Card>

                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" onClick={() => setPdfOpen(true)}>
                    <FileText size={16} /> Generar PDF
                  </Button>
                  <Button variant="outline" className="flex-1">Guardar borrador</Button>
                </div>
              </div>

              <div className="lg:col-span-3">
                <WorkProjectionPanel
                  estimateId={draft.id}
                  status={draft.status}
                  createdBy={draft.createdBy}
                  clientName={draft.clientName}
                  onChanged={() => setReloadToken((t) => t + 1)}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-foreground">Assembly Templates</h2>
              <Button size="sm" className="gap-2">
                <Plus size={14} /> New Template
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Recetas reutilizables por negocio — materiales, mano de obra y subcontratistas predefinidos.
            </p>

            {templatesLoading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Spinner className="size-4" /> Cargando plantillas...
              </div>
            )}
            {templatesError && <ErrorNote message={templatesError} />}

            {!templatesLoading && !templatesError && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {assemblyTemplates?.map((template) => (
                  <Card key={template.id} className="p-4 hover:border-primary/40 transition-colors">
                    <p className="font-medium text-foreground">{template.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {template.itemCount} ítems · {template.laborHours} hrs de mano de obra
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1">Insertar en presupuesto</Button>
                      <Button size="sm" variant="outline">Editar</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="categorias" className="mt-4">
          <BudgetCategoriesPanel />
        </TabsContent>
      </Tabs>

      {draft && (
        <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Vista previa del PDF</DialogTitle>
              <DialogDescription>
                Presupuesto #{draft.id.slice(0, 8).toUpperCase()} para {draft.clientName}
              </DialogDescription>
            </DialogHeader>
            <div className="border border-border rounded-lg p-6 bg-secondary/40 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">Presupuesto de reforma</p>
                <p className="text-xs text-muted-foreground">{draft.createdAt}</p>
              </div>
              <div className="text-sm text-muted-foreground">
                Cliente: {draft.clientName} · {draft.clientAddress}
              </div>
              <div className="space-y-1 text-sm">
                {lines.filter((_, i) => visibility[i]).map((line) => (
                  <div key={line.id} className="flex justify-between">
                    <span className="text-muted-foreground">{line.item}</span>
                    <span className="text-foreground">{formatCurrency(line.quantity * line.unitCost)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPdfOpen(false)}>Cerrar</Button>
              <Button>Descargar PDF</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
