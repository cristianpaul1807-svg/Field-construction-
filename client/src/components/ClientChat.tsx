import { useState } from "react";
import { useApi, apiFetch } from "@/lib/api";
import { ChatList } from "@/components/chat/ChatList";
import { ChatThread } from "@/components/chat/ChatThread";
import { openChatAttachment, sendChatAttachment } from "@/lib/chatAttachments";
import type { ChatChannel, ChatMessage } from "@/lib/chatApi";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "react-i18next";

export function ClientChat() {
  const { t, i18n } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const { data: channels, loading } = useApi<ChatChannel[]>(`/api/client/chat/channels?_r=${reloadToken}`);
  const { data: messages, reload: reloadMessages } = useApi<ChatMessage[]>(
    activeId ? `/api/client/chat/channels/${activeId}/messages?_r=${reloadToken}` : null
  );

  const activeChannel = channels?.find((c) => c.id === activeId) ?? null;
  const refresh = () => setReloadToken((t) => t + 1);

  const sendMessage = async (content: string) => {
    if (!activeId) return;
    await apiFetch(`/api/client/chat/channels/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("worker.loadingMessages")}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] h-[520px]">
        <div className="border-b sm:border-b-0 sm:border-r border-border overflow-hidden">
          <ChatList channels={channels} activeId={activeId} onSelect={setActiveId} emptyLabel={t("communication.noMessages")} />
        </div>
        <ChatThread
          channel={activeChannel}
          messages={activeId ? messages ?? null : null}
          ownSenderTypes={["client"]}
          onSend={sendMessage}
          onSendFile={async (file) => {
            if (!activeId) return;
            await sendChatAttachment(activeId, file, "/client");
            reloadMessages();
          }}
          onOpenAttachment={(message) => openChatAttachment(message, "/client", i18n.language)}
        />
      </div>
    </div>
  );
}
