import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { MessageCircle, Send } from "lucide-react";

export default function SettingsWhatsapp() {
  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title="WhatsApp Connection" description="Conecta el número de WhatsApp Business del negocio" />

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg bg-status-success-bg flex items-center justify-center flex-shrink-0">
            <MessageCircle size={20} className="text-status-success-fg" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">WhatsApp Business (Cloud API directa de Meta)</p>
              <StatusBadge tone="warning">No conectado</StatusBadge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Conexión directa vía Meta Business Manager + Meta Developer Console — sin BSP intermediario
              (Twilio/Wati/360dialog). Se paga únicamente la tarifa de Meta por mensaje.
            </p>
            <Button className="gap-2 mt-4">
              <Send size={16} /> Iniciar Embedded Signup
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-3 text-sm">Qué necesitarás para conectar</h3>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Una cuenta de Meta Business Manager verificada para el negocio.</li>
          <li>Acceso al Meta Developer Console para crear la app de WhatsApp Business.</li>
          <li>El número de teléfono que se usará para atender a los clientes.</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-4">
          Este es un placeholder — la conexión real (Embedded Signup, manejo de tokens y webhooks)
          se implementa en la Fase C del proyecto.
        </p>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-3 text-sm">Bot de Telegram del equipo</h3>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Usado para check-in/check-out y notificaciones de work orders</p>
          <StatusBadge tone="warning">No conectado</StatusBadge>
        </div>
        <Button variant="outline" className="mt-4">Conectar bot de Telegram</Button>
      </Card>
    </div>
  );
}
