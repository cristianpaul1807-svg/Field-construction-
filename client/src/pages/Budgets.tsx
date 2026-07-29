import { useState } from "react";
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
import { StatusBadge } from "@/components/StatusBadge";
import { FileText, Plus } from "lucide-react";
import { estimates, assemblyTemplates, findClient, formatCurrency } from "@/lib/mockData";

export default function Budgets() {
  const draft = estimates[0];
  const [marginType, setMarginType] = useState<"global" | "section">(draft.marginType);
  const [marginPercent, setMarginPercent] = useState(draft.marginPercent);
  const [wastePercent, setWastePercent] = useState(draft.wastePercent);
  const [visibility, setVisibility] = useState<boolean[]>(draft.lines.map((l) => l.visibleToClient));
  const [pdfOpen, setPdfOpen] = useState(false);

  const client = findClient(draft.clientId);
  const subtotal = draft.lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
  const wasteAmount = subtotal * (wastePercent / 100);
  const marginAmount = (subtotal + wasteAmount) * (marginPercent / 100);
  const total = subtotal + wasteAmount + marginAmount;

  const zones = Array.from(new Set(draft.lines.map((l) => l.zone)));

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
        </TabsList>

        <TabsContent value="builder" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Presupuesto #{draft.id.toUpperCase()}</h2>
                    <p className="text-xs text-muted-foreground">{client?.name} · borrador en curso</p>
                  </div>
                  <StatusBadge tone="info">{draft.status}</StatusBadge>
                </div>

                {zones.map((zone) => (
                  <div key={zone} className="border border-border rounded-lg p-4 mb-4 last:mb-0">
                    <h3 className="font-medium text-foreground mb-3">Zona: {zone}</h3>
                    {["Materiales", "Mano de obra", "Subcontratistas"].map((category) => {
                      const lines = draft.lines
                        .map((line, idx) => ({ line, idx }))
                        .filter(({ line }) => line.zone === zone && line.category === category);
                      if (lines.length === 0) return null;
                      return (
                        <div key={category} className="mb-3 pl-4 border-l-2 border-primary/40 last:mb-0">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{category}</h4>
                          <div className="space-y-2">
                            {lines.map(({ line, idx }) => (
                              <div key={idx} className="flex items-center justify-between gap-3 text-sm">
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
          </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {assemblyTemplates.map((template) => (
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
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Vista previa del PDF</DialogTitle>
            <DialogDescription>Presupuesto #{draft.id.toUpperCase()} para {client?.name}</DialogDescription>
          </DialogHeader>
          <div className="border border-border rounded-lg p-6 bg-secondary/40 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Presupuesto de reforma</p>
              <p className="text-xs text-muted-foreground">{draft.createdAt}</p>
            </div>
            <div className="text-sm text-muted-foreground">
              Cliente: {client?.name} · {client?.address}
            </div>
            <div className="space-y-1 text-sm">
              {draft.lines.filter((_, i) => visibility[i]).map((line, idx) => (
                <div key={idx} className="flex justify-between">
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
    </div>
  );
}
