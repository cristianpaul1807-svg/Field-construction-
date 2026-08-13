import { useState } from "react";
import { useApi, apiFetch, readJson } from "@/lib/api";
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
  const [payingMessageId, setPayingMessageId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

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

  // Paying an invoice without leaving the conversation it arrived in. The
  // checkout session is the same one the portal's own pay button opens — one
  // invoice, one link, whichever way the customer reached it.
  const payInvoice = async (invoiceId: string, messageId: string) => {
    setPayingMessageId(messageId);
    setPayError(null);
    try {
      const res = await apiFetch(`/api/client/invoices/${invoiceId}/checkout`, { method: "POST" });
      const body = await readJson<{ url?: string; error?: string }>(res);
      if (!res.ok || !body?.url) throw new Error(body?.error || t("clientPortal.payError"));
      window.location.href = body.url;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : t("clientPortal.payError"));
      setPayingMessageId(null);
    }
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
          onPayAttachment={(message) => {
            if (message.attachment?.id) payInvoice(message.attachment.id, message.id);
          }}
          payingMessageId={payingMessageId}
        />
      </div>
      {payError && <p className="px-4 pb-3 text-sm text-status-error-fg">{payError}</p>}
    </div>
  );
}
