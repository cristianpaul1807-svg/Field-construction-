import { useCallback, useEffect, useState } from "react";
import { ChatList } from "@/components/chat/ChatList";
import { ChatThread } from "@/components/chat/ChatThread";
import { workerApiFetch } from "@/lib/workerSession";
import type { ChatChannel, ChatMessage } from "@/lib/chatApi";
import { Spinner } from "@/components/ui/spinner";

export function WorkerChat() {
  const [channels, setChannels] = useState<ChatChannel[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);

  const loadChannels = useCallback(async () => {
    const res = await workerApiFetch("/api/worker/chat/channels");
    const body = await res.json();
    setChannels(body);
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    setMessages(null);
    const res = await workerApiFetch(`/api/worker/chat/channels/${id}/messages`);
    const body = await res.json();
    setMessages(body);
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId, loadMessages]);

  const activeChannel = channels?.find((c) => c.id === activeId) ?? null;

  const sendMessage = async (content: string) => {
    if (!activeId) return;
    await workerApiFetch(`/api/worker/chat/channels/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    await loadMessages(activeId);
    await loadChannels();
  };

  const acceptInvite = async () => {
    if (!activeId) return;
    await workerApiFetch(`/api/worker/chat/channels/${activeId}/accept`, { method: "POST" });
    await loadChannels();
  };

  if (channels === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Spinner className="size-4" /> Cargando mensajes...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] h-[520px]">
        <div className="border-b sm:border-b-0 sm:border-r border-border overflow-hidden">
          <ChatList channels={channels} activeId={activeId} onSelect={setActiveId} emptyLabel="Sin mensajes todavía." />
        </div>
        <ChatThread
          channel={activeChannel}
          messages={activeId ? messages : null}
          ownSenderTypes={["employee", "subcontractor"]}
          onSend={sendMessage}
          showAcceptInvite={activeChannel?.status === "invitado"}
          onAccept={acceptInvite}
        />
      </div>
    </div>
  );
}
