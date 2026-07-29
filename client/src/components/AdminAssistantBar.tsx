import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, ChevronDown, Bot, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AssistantMessage {
  id: string;
  role: "admin" | "assistant";
  content: string;
  createdAt: string;
}

// Internal admin <-> AI chat — distinct from the client-facing WhatsApp
// bot in Communication.tsx. No model is wired in yet (Fase D); this is
// the ready-to-connect shell: it stores real history in
// admin_assistant_messages and round-trips through the API, but replies
// come back as a clearly-labeled placeholder until the Claude API key
// is configured.
export function AdminAssistantBar() {
  const [expanded, setExpanded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const { data: messages, loading } = useApi<AssistantMessage[]>(`/api/admin-assistant/messages?_r=${reloadToken}`);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, expanded]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");
    setExpanded(true);
    try {
      const res = await fetch("/api/admin-assistant/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error();
    } finally {
      setSending(false);
      setReloadToken((t) => t + 1);
    }
  };

  return (
    <div className="relative flex-shrink-0 border-t border-border bg-card">
      {expanded && (
        <div className="absolute bottom-full left-0 right-0 max-h-80 flex flex-col border-t border-border bg-card shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles size={14} className="text-primary" /> Asistente del negocio
            </div>
            <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground">
              <ChevronDown size={16} />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {loading && <p className="text-xs text-muted-foreground">Cargando...</p>}
            {messages?.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Pídele que agregue una proyección de trabajo, revise presupuestos pendientes, o cualquier cosa que quieras
                automatizar — por ahora responde con un mensaje de "todavía no conectada", listo para Fase D.
              </p>
            )}
            {messages?.map((m) => (
              <div key={m.id} className={cn("flex gap-2", m.role === "admin" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-status-info-bg flex items-center justify-center flex-shrink-0">
                    <Bot size={12} className="text-status-info-fg" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    m.role === "admin"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-foreground rounded-bl-sm"
                  )}
                >
                  {m.content}
                </div>
                {m.role === "admin" && (
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                    <UserRound size={12} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-2.5">
        <Sparkles size={16} className="text-primary flex-shrink-0" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Pídele algo al asistente del negocio..."
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
        />
        <Button size="icon" variant="ghost" onClick={send} disabled={sending || !draft.trim()}>
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
