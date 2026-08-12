import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Send, Settings, Bot, UserRound, Paperclip, FileText, Download, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatChannel, ChatMessage } from "@/lib/chatApi";
import { useTranslation } from "react-i18next";

function initials(name: string | null | undefined) {
  return (name ?? "?").trim().charAt(0).toUpperCase() || "?";
}

interface ChatThreadProps {
  channel: ChatChannel | null;
  messages: ChatMessage[] | null;
  ownSenderTypes: string[];
  onSend: (content: string) => void | Promise<void>;
  /** Uploads a file into this conversation. Omitted where attachments aren't allowed. */
  onSendFile?: (file: File) => void | Promise<void>;
  /** Resolves a message's attachment to something openable. */
  onOpenAttachment?: (message: ChatMessage) => void | Promise<void>;
  onUpdateSettings?: (patch: { disappearingDuration: "24h" | "72h" | "nunca" }) => void | Promise<void>;
  onToggleControlMode?: () => void | Promise<void>;
  showAcceptInvite?: boolean;
  onAccept?: () => void | Promise<void>;
  disabled?: boolean;
}

export function ChatThread({
  channel,
  messages,
  ownSenderTypes,
  onSend,
  onSendFile,
  onOpenAttachment,
  onUpdateSettings,
  onToggleControlMode,
  showAcceptInvite,
  onAccept,
  disabled,
}: ChatThreadProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!channel) {
    return <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">{t("communication.selectChat")}</div>;
  }

  const submit = async () => {
    if (!text.trim()) return;
    const content = text;
    setText("");
    setSending(true);
    try {
      await onSend(content);
    } finally {
      setSending(false);
    }
  };

  const blocked = disabled || channel.status === "invitado";

  return (
    <div className="flex flex-col min-w-0 flex-1">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar>
            {channel.participantAvatarUrl && <AvatarImage src={channel.participantAvatarUrl} />}
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials(channel.participantName)}
            </AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium text-foreground truncate">{channel.participantName ?? "Chat"}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onToggleControlMode && channel.label === "cliente" && (
            <>
              <StatusBadge tone={channel.controlMode === "bot" ? "info" : "success"}>
                {channel.controlMode === "bot" ? t("dashboard.controlBot") : t("dashboard.controlHuman")}
              </StatusBadge>
              <Button size="sm" variant={channel.controlMode === "bot" ? "default" : "outline"} onClick={onToggleControlMode}>
                {channel.controlMode === "bot" ? t("communication.takeControl") : t("communication.returnToBot")}
              </Button>
            </>
          )}

          {onUpdateSettings && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost">
                  <Settings size={16} />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("communication.chatSettings")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-1.5 py-2">
                  <p className="text-sm text-foreground">{t("communication.autoDelete")}</p>
                  <Select
                    value={channel.disappearingDuration}
                    onValueChange={(v) => onUpdateSettings({ disappearingDuration: v as "24h" | "72h" | "nunca" })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nunca">{t("communication.never")}</SelectItem>
                      <SelectItem value="24h">{t("communication.hours24")}</SelectItem>
                      <SelectItem value="72h">{t("communication.hours72")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t("communication.autoDeleteNote")}
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/40">
        {messages === null && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Spinner className="size-4" /> {t("common.loading")}
          </div>
        )}
        {messages?.map((message) => {
          const isOwn = ownSenderTypes.includes(message.senderType);
          return (
            <div key={message.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                  isOwn
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border text-foreground rounded-bl-sm"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.attachment && (
                  // A document in a conversation has to look like a document,
                  // not like a line of text — otherwise nobody opens it.
                  <button
                    onClick={() => onOpenAttachment?.(message)}
                    disabled={!onOpenAttachment}
                    className={cn(
                      "mt-2 w-full flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      isOwn
                        ? "border-primary-foreground/25 hover:bg-primary-foreground/10"
                        : "border-border hover:bg-secondary"
                    )}
                  >
                    {message.attachment.kind === "image" ? (
                      <ImageIcon size={16} strokeWidth={1.75} className="flex-shrink-0" />
                    ) : (
                      <FileText size={16} strokeWidth={1.75} className="flex-shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 truncate text-xs">
                      {message.attachment.name ?? t("communication.attachment")}
                    </span>
                    {onOpenAttachment && <Download size={14} strokeWidth={1.75} className="flex-shrink-0 opacity-70" />}
                  </button>
                )}
                <div className="flex items-center gap-1 mt-1 opacity-70">
                  <span className="text-[10px]">{message.timestamp?.slice(0, 16).replace("T", " ")}</span>
                  {message.senderType === "bot" && (
                    <span className="text-[10px] inline-flex items-center gap-0.5">
                      <Bot size={10} /> Bot
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {showAcceptInvite ? (
        <div className="p-4 border-t border-border flex items-center justify-between gap-3 bg-card">
          <p className="text-sm text-muted-foreground">{t("communication.invitationPrompt")}</p>
          <Button onClick={onAccept} className="gap-2">
            <UserRound size={14} /> {t("communication.accept")}
          </Button>
        </div>
      ) : (
        <form
          className="p-3 border-t border-border flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {onSendFile && (
            <>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setSending(true);
                  try {
                    await onSendFile(file);
                  } finally {
                    setSending(false);
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={blocked || sending}
                onClick={() => fileInput.current?.click()}
                aria-label={t("communication.attachFile")}
              >
                <Paperclip size={16} />
              </Button>
            </>
          )}
          <Input
            placeholder={blocked ? t("communication.acceptToWrite") : t("communication.typeMessage")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={blocked}
          />
          <Button type="submit" size="icon" disabled={blocked || sending || !text.trim()}>
            {sending ? <Spinner className="size-4" /> : <Send size={16} />}
          </Button>
        </form>
      )}
    </div>
  );
}
