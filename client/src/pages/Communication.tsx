import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Send, Bot, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/api";

interface Conversation {
  id: string;
  clientId: string;
  clientName: string | null;
  clientPhone: string | null;
  controlMode: "bot" | "human";
  lastMessage: string | null;
}

interface Message {
  id: string;
  direction: "in" | "out";
  content: string;
  sentBy: "bot" | "human";
  timestamp: string;
}

export default function Communication() {
  const { data: conversations, loading, error } = useApi<Conversation[]>("/api/conversations");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modeOverride, setModeOverride] = useState<Record<string, "bot" | "human">>({});

  useEffect(() => {
    if (!activeId && conversations && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  const { data: messages, loading: messagesLoading } = useApi<Message[]>(
    activeId ? `/api/conversations/${activeId}/messages` : null
  );

  const activeConversation = conversations?.find((c) => c.id === activeId);
  const mode = activeId ? (modeOverride[activeId] ?? activeConversation?.controlMode ?? "bot") : "bot";

  const toggleControl = async () => {
    if (!activeId) return;
    const next = mode === "bot" ? "human" : "bot";
    setModeOverride((prev) => ({ ...prev, [activeId]: next }));
    try {
      const res = await fetch(`/api/conversations/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlMode: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setModeOverride((prev) => ({ ...prev, [activeId]: mode }));
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Communication"
        description="Bandeja unificada de WhatsApp — un solo hilo por cliente"
      />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Cargando conversaciones...
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          No se pudo cargar desde Supabase: {error}
        </div>
      )}

      {!loading && !error && (
        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] h-[560px]">
            <div className="border-b sm:border-b-0 sm:border-r border-border overflow-y-auto">
              {conversations?.map((conv) => {
                const convMode = modeOverride[conv.id] ?? conv.controlMode;
                const isActive = conv.id === activeId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveId(conv.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border flex items-center gap-3 transition-colors",
                      isActive ? "bg-secondary" : "hover:bg-secondary/60"
                    )}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {conv.clientName?.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{conv.clientName}</p>
                        {convMode === "bot" ? (
                          <Bot size={13} className="text-status-info-fg flex-shrink-0" />
                        ) : (
                          <UserRound size={13} className="text-status-success-fg flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                    </div>
                  </button>
                );
              })}
              {conversations?.length === 0 && (
                <p className="p-4 text-xs text-muted-foreground">Sin conversaciones todavía.</p>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              {activeConversation && (
                <>
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{activeConversation.clientName}</p>
                      <p className="text-xs text-muted-foreground">{activeConversation.clientPhone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={mode === "bot" ? "info" : "success"}>
                        {mode === "bot" ? "Respondiendo: Bot" : "Respondiendo: Humano"}
                      </StatusBadge>
                      <Button size="sm" variant={mode === "bot" ? "default" : "outline"} onClick={toggleControl}>
                        {mode === "bot" ? "Tomar conversación" : "Devolver al bot"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/40">
                    {messagesLoading && (
                      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                        <Spinner className="size-4" /> Cargando mensajes...
                      </div>
                    )}
                    {messages?.map((message) => (
                      <div
                        key={message.id}
                        className={cn("flex", message.direction === "out" ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                            message.direction === "out"
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-card border border-border text-foreground rounded-bl-sm"
                          )}
                        >
                          <p>{message.content}</p>
                          <div className="flex items-center gap-1 mt-1 opacity-70">
                            <span className="text-[10px]">{message.timestamp?.slice(0, 16).replace("T", " ")}</span>
                            {message.direction === "out" && (
                              <span className="text-[10px]">· {message.sentBy === "bot" ? "Bot" : "Humano"}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 border-t border-border flex items-center gap-2">
                    <input
                      placeholder={mode === "bot" ? "Toma la conversación para responder..." : "Escribe un mensaje..."}
                      disabled={mode === "bot"}
                      className="flex-1 text-sm border border-input rounded-full px-4 py-2 bg-card disabled:opacity-50"
                    />
                    <Button size="icon" disabled={mode === "bot"}>
                      <Send size={16} />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Conectado vía WhatsApp Cloud API directa de Meta (sin BSP). El bot usa el motor de
        presupuestos + assembly templates del negocio para responder automáticamente.
      </p>
    </div>
  );
}
