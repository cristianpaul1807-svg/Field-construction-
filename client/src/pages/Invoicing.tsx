import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, invoiceStatusTone } from "@/components/StatusBadge";
import { Send } from "lucide-react";
import { invoices, findClient, findProject, formatCurrency } from "@/lib/mockData";

const typeLabel = { deposito: "Depósito", parcial: "Parcial", final: "Final" };
const statusLabel = { pendiente: "Pendiente", pagado: "Pagado", vencido: "Vencido" };

export default function Invoicing() {
  const totalPending = invoices.filter((i) => i.status !== "pagado").reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter((i) => i.status === "pagado").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Invoicing & Payments"
        description="Depósito, pagos parciales y pago final por proyecto"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Cobrado</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Pendiente / vencido</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{formatCurrency(totalPending)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Facturas totales</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{invoices.length}</p>
        </Card>
      </div>

      <Card className="p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 text-muted-foreground font-medium">Proyecto</th>
              <th className="text-left py-2 text-muted-foreground font-medium">Cliente</th>
              <th className="text-left py-2 text-muted-foreground font-medium">Tipo</th>
              <th className="text-right py-2 text-muted-foreground font-medium">Monto</th>
              <th className="text-left py-2 text-muted-foreground font-medium">Vencimiento</th>
              <th className="text-left py-2 text-muted-foreground font-medium">Estado</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const project = findProject(invoice.projectId);
              const client = findClient(invoice.clientId);
              return (
                <tr key={invoice.id} className="border-b border-border last:border-0 hover:bg-secondary transition-colors">
                  <td className="py-3 text-foreground font-medium">{project?.name}</td>
                  <td className="py-3 text-muted-foreground">{client?.name}</td>
                  <td className="py-3 text-muted-foreground">{typeLabel[invoice.type]}</td>
                  <td className="py-3 text-right text-foreground">{formatCurrency(invoice.amount)}</td>
                  <td className="py-3 text-muted-foreground">{invoice.dueDate}</td>
                  <td className="py-3">
                    <StatusBadge tone={invoiceStatusTone[invoice.status]}>{statusLabel[invoice.status]}</StatusBadge>
                  </td>
                  <td className="py-3 text-right">
                    {invoice.status !== "pagado" && (
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Send size={13} /> Reenviar link
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Procesado con Stripe (Payment Intents + Connect) — cada negocio recibirá su propia cuenta
        conectada en Fase E.
      </p>
    </div>
  );
}
