import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Send, Bot, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { clients, whatsappMessages, conversationControl as initialControl } from "@/lib/mockData";

export default function Communication() {
  const clientIds = Array.from(new Set(whatsappMessages.map((m) => m.clientId)));
  const [activeId, setActiveId] = useState(clientIds[0]);
  const [control, setControl] = useState(initialControl);

  const activeClient = clients.find((c) => c.id === activeId);
  const activeMessages = whatsappMessages.filter((m) => m.clientId === activeId);
  const mode = control[activeId] ?? "bot";

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Communication"
        description="Bandeja unificada de WhatsApp — un solo hilo por cliente"
      />

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] h-[560px]">
          {/* Conversation list */}
          <div className="border-b sm:border-b-0 sm:border-r border-border overflow-y-auto">
            {clientIds.map((id) => {
              const client = clients.find((c) => c.id === id);
              const lastMessage = [...whatsappMessages].reverse().find((m) => m.clientId === id);
              if (!client || !lastMessage) return null;
              const isActive = id === activeId;
              return (
                <button
                  key={id}
                  onClick={() => setActiveId(id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border flex items-center gap-3 transition-colors",
                    isActive ? "bg-secondary" : "hover:bg-secondary/60"
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {client.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                      {(control[id] ?? "bot") === "bot" ? (
                        <Bot size={13} className="text-status-info-fg flex-shrink-0" />
                      ) : (
                        <UserRound size={13} className="text-status-success-fg flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{lastMessage.content}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active thread */}
          <div className="flex flex-col min-w-0">
            {activeClient && (
              <>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{activeClient.name}</p>
                    <p className="text-xs text-muted-foreground">{activeClient.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={mode === "bot" ? "info" : "success"}>
                      {mode === "bot" ? "Respondiendo: Bot" : "Respondiendo: Humano"}
                    </StatusBadge>
                    <Button
                      size="sm"
                      variant={mode === "bot" ? "default" : "outline"}
                      onClick={() =>
                        setControl((prev) => ({
                          ...prev,
                          [activeId]: prev[activeId] === "human" ? "bot" : "human",
                        }))
                      }
                    >
                      {mode === "bot" ? "Tomar conversación" : "Devolver al bot"}
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/40">
                  {activeMessages.map((message) => (
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
                          <span className="text-[10px]">{message.timestamp}</span>
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

      <p className="text-xs text-muted-foreground">
        Conectado vía WhatsApp Cloud API directa de Meta (sin BSP). El bot usa el motor de
        presupuestos + assembly templates del negocio para responder automáticamente.
      </p>
    </div>
  );
}
