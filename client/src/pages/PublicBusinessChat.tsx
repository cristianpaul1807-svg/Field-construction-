import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Send, ClipboardList, CalendarDays, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadSession {
  businessId: string;
  clientId: string;
  conversationId: string;
}

interface Message {
  id: string;
  direction: "in" | "out";
  content: string;
  sentBy: "bot" | "human";
  timestamp: string;
}

function storageKey(slug: string) {
  return `fsm-public-lead-${slug}`;
}

function loadLeadSession(slug: string): LeadSession | null {
  const raw = localStorage.getItem(storageKey(slug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LeadSession;
  } catch {
    return null;
  }
}

export default function PublicBusinessChat() {
  const { slug } = useParams<{ slug: string }>();
  const [business, setBusiness] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [lead, setLead] = useState<LeadSession | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBubble, setActiveBubble] = useState<"presupuesto" | "cita" | null>(null);
  const [freeText, setFreeText] = useState("");
  const [budgetText, setBudgetText] = useState("");
  const [appointmentWhen, setAppointmentWhen] = useState("");
  const [appointmentWhy, setAppointmentWhy] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/businesses/${slug}`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then(setBusiness);
    setLead(loadLeadSession(slug));
  }, [slug]);

  const loadMessages = () => {
    if (!lead) return;
    fetch(`/api/public/conversations/${lead.conversationId}/messages`)
      .then((res) => res.json())
      .then(setMessages);
  };

  useEffect(loadMessages, [lead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startConversation = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/public/businesses/${slug}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "No se pudo iniciar la conversación");
      const session: LeadSession = { businessId: body.businessId, clientId: body.clientId, conversationId: body.conversationId };
      localStorage.setItem(storageKey(slug!), JSON.stringify(session));
      setLead(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la conversación");
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!lead || !content.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/public/conversations/${lead.conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      loadMessages();
    } finally {
      setBusy(false);
    }
  };

  const submitFreeText = async () => {
    const text = freeText;
    setFreeText("");
    await sendMessage(text);
  };

  const submitBudgetRequest = async () => {
    const text = budgetText;
    setBudgetText("");
    setActiveBubble(null);
    await sendMessage(`Pidió un presupuesto: ${text}`);
  };

  const submitAppointmentRequest = async () => {
    if (!lead || !appointmentWhen.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/public/conversations/${lead.conversationId}/appointment-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedDatetimeText: appointmentWhen, reasonText: appointmentWhy || null }),
      });
      setAppointmentWhen("");
      setAppointmentWhy("");
      setActiveBubble(null);
      loadMessages();
    } finally {
      setBusy(false);
    }
  };

  if (business === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (business === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <h1 className="text-lg font-semibold text-foreground">No encontramos este negocio</h1>
          <p className="text-sm text-muted-foreground">Revisa que el link esté completo y correcto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold text-sm">
          {business.name.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm leading-tight">{business.name}</p>
          <p className="text-xs text-muted-foreground leading-tight">Chat con el negocio</p>
        </div>
      </div>

      {!lead ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center space-y-2">
              <MessageCircle className="mx-auto text-primary" size={28} />
              <h1 className="text-xl font-semibold text-foreground">Empecemos</h1>
              <p className="text-sm text-muted-foreground">
                Déjanos tus datos para que {business.name} pueda darte seguimiento.
              </p>
            </div>
            <Card className="p-6">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  startConversation();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input id="phone" name="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {error && <p className="text-sm text-status-error-fg">{error}</p>}
                <Button type="submit" className="w-full" disabled={!name || !phone || !email || busy}>
                  Empezar conversación
                </Button>
              </form>
            </Card>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages === null && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Spinner className="size-4" /> Cargando...
              </div>
            )}
            {messages?.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Escribe tu mensaje, o usa las opciones de abajo.
              </p>
            )}
            {messages?.map((message) => (
              <div key={message.id} className={cn("flex", message.direction === "in" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                    message.direction === "in"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border text-foreground rounded-bl-sm"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border bg-card p-3 space-y-3">
            {activeBubble === "presupuesto" && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <Label htmlFor="budget-text" className="text-xs">Cuéntanos qué necesitas</Label>
                <Input id="budget-text" value={budgetText} onChange={(e) => setBudgetText(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitBudgetRequest} disabled={!budgetText.trim() || busy}>Enviar</Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveBubble(null)}>Cancelar</Button>
                </div>
              </div>
            )}

            {activeBubble === "cita" && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="appt-when" className="text-xs">¿Cuándo te gustaría?</Label>
                  <Input id="appt-when" value={appointmentWhen} onChange={(e) => setAppointmentWhen(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="appt-why" className="text-xs">Motivo (opcional)</Label>
                  <Input id="appt-why" value={appointmentWhy} onChange={(e) => setAppointmentWhy(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitAppointmentRequest} disabled={!appointmentWhen.trim() || busy}>
                    Enviar solicitud
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveBubble(null)}>Cancelar</Button>
                </div>
              </div>
            )}

            {!activeBubble && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setActiveBubble("presupuesto")}>
                  <ClipboardList size={14} /> Pedir presupuesto
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setActiveBubble("cita")}>
                  <CalendarDays size={14} /> Agendar cita
                </Button>
              </div>
            )}

            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submitFreeText();
              }}
            >
              <Input
                placeholder="Escribe un mensaje..."
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
              />
              <Button type="submit" size="icon" disabled={!freeText.trim() || busy}>
                <Send size={16} />
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
