import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Send, CalendarDays } from "lucide-react";
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

interface FlowOption {
  value: string;
  label: string;
}

interface FlowView {
  controlMode: "bot" | "human" | null;
  step: string;
  kind: "button" | "buttons" | "text" | "terminal";
  options?: FlowOption[];
  placeholder?: string;
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
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [flow, setFlow] = useState<FlowView | null>(null);
  const [busy, setBusy] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [freeText, setFreeText] = useState("");
  const [activeBubble, setActiveBubble] = useState<"cita" | null>(null);
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

  // No upfront form — the conversation (and its welcome message) starts the
  // moment the page loads, matching the button-flow's "no me hagas escribir
  // nada hasta que haga falta" design.
  useEffect(() => {
    if (!slug || business === undefined || business === null || lead) return;
    setStarting(true);
    setStartError(null);
    fetch(`/api/public/businesses/${slug}/leads`, { method: "POST" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || "No se pudo iniciar la conversación");
        const session: LeadSession = { businessId: body.businessId, clientId: body.clientId, conversationId: body.conversationId };
        localStorage.setItem(storageKey(slug), JSON.stringify(session));
        setLead(session);
      })
      .catch((err) => setStartError(err instanceof Error ? err.message : "No se pudo iniciar la conversación"))
      .finally(() => setStarting(false));
  }, [slug, business, lead]);

  const loadMessages = () => {
    if (!lead) return;
    fetch(`/api/public/conversations/${lead.conversationId}/messages`)
      .then((res) => res.json())
      .then(setMessages);
  };

  const loadFlow = () => {
    if (!lead) return;
    fetch(`/api/public/conversations/${lead.conversationId}/flow`)
      .then((res) => res.json())
      .then(setFlow);
  };

  useEffect(() => {
    loadMessages();
    loadFlow();
  }, [lead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submitAnswer = async (value: string) => {
    if (!lead || !value.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/public/conversations/${lead.conversationId}/flow/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const body = await res.json();
      setFlow(body);
      setTextValue("");
      loadMessages();
    } finally {
      setBusy(false);
    }
  };

  const sendFreeText = async () => {
    if (!lead || !freeText.trim() || busy) return;
    const content = freeText;
    setFreeText("");
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

  // Once an admin has taken manual control, or the flow has run its course,
  // fall back to a plain free-text box instead of the guided controls.
  const showFreeTextOnly = !flow || flow.controlMode === "human" || flow.kind === "terminal";

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

      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(starting || messages === null) && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner className="size-4" /> Cargando...
            </div>
          )}
          {startError && <p className="text-center text-sm text-status-error-fg py-8">{startError}</p>}
          {messages?.map((message) => (
            <div key={message.id} className={cn("flex", message.direction === "in" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                  message.direction === "in"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border text-foreground rounded-bl-sm"
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {lead && (
          <div className="border-t border-border bg-card p-3 space-y-3">
            {!showFreeTextOnly && flow && (flow.kind === "button" || flow.kind === "buttons") && (
              <div className="flex flex-wrap gap-2">
                {flow.options?.map((option) => (
                  <Button
                    key={option.value}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => submitAnswer(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}

            {!showFreeTextOnly && flow && flow.kind === "text" && (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAnswer(textValue);
                }}
              >
                <Input
                  placeholder={flow.placeholder}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  autoFocus
                />
                <Button type="submit" size="icon" disabled={!textValue.trim() || busy}>
                  <Send size={16} />
                </Button>
              </form>
            )}

            {showFreeTextOnly && (
              <>
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
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setActiveBubble("cita")}>
                      <CalendarDays size={14} /> Agendar cita
                    </Button>
                  </div>
                )}

                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendFreeText();
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
