import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApi, apiFetch, readJson } from "@/lib/api";
import { ChatList } from "@/components/chat/ChatList";
import { ChatThread } from "@/components/chat/ChatThread";
import { openChatAttachment, sendChatAttachment } from "@/lib/chatAttachments";
import type { ChatChannel, ChatMessage, DirectoryContact } from "@/lib/chatApi";
import { AppointmentRequestsPanel } from "@/components/AppointmentRequestsPanel";
import { useTranslation } from "react-i18next";

type LabelFilter = "general" | "trabajador" | "subcontrato" | "cliente";

function initials(name: string | null | undefined) {
  return (name ?? "?").trim().charAt(0).toUpperCase() || "?";
}

function NewConversationDialog({ onStarted }: { onStarted: (id: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: directory, loading } = useApi<DirectoryContact[]>(open ? "/api/chat/directory" : null);

  const filtered = (directory ?? []).filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const start = async (contact: DirectoryContact) => {
    const res = await apiFetch("/api/chat/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantType: contact.participantType, participantId: contact.participantId }),
    });
    const body = await readJson(res);
    setOpen(false);
    onStarted(body.id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus size={14} /> {t("communication.newConversation")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("communication.newConversation")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("communication.searchContact")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {loading && <p className="text-sm text-muted-foreground p-2">{t("common.loading")}</p>}
            {filtered.map((c) => (
              <button
                key={`${c.participantType}-${c.participantId}`}
                onClick={() => start(c)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary text-left"
              >
                <Avatar className="size-8">
                  {c.avatarUrl && <AvatarImage src={c.avatarUrl} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials(c.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{t(`communication.labels.${c.participantType === "employee" ? "trabajador" : c.participantType === "subcontractor" ? "subcontrato" : "cliente"}`)}</p>
                </div>
              </button>
            ))}
            {!loading && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground p-2">{t("communication.allContactsHaveChat")}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Communication() {
  const { t, i18n } = useTranslation();
  const [system, setSystem] = useState<"publico" | "interno">("publico");
  const [labelFilter, setLabelFilter] = useState<LabelFilter>("general");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const query = new URLSearchParams({ system });
  if (system === "interno" && labelFilter !== "general") query.set("label", labelFilter);

  const { data: channels, loading, error } = useApi<ChatChannel[]>(`/api/chat/channels?${query.toString()}&_r=${reloadToken}`);
  const { data: messages, reload: reloadMessages } = useApi<ChatMessage[]>(
    activeId ? `/api/chat/channels/${activeId}/messages?_r=${reloadToken}` : null
  );

  const activeChannel = channels?.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    setActiveId(null);
  }, [system, labelFilter]);

  const refresh = () => setReloadToken((t) => t + 1);

  const sendMessage = async (content: string) => {
    if (!activeId) return;
    await apiFetch(`/api/chat/channels/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    refresh();
  };

  const toggleControlMode = async () => {
    if (!activeChannel) return;
    const next = activeChannel.controlMode === "bot" ? "human" : "bot";
    await apiFetch(`/api/chat/channels/${activeChannel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ controlMode: next }),
    });
    refresh();
  };

  const updateSettings = async (patch: { disappearingDuration: "24h" | "72h" | "nunca" }) => {
    if (!activeId) return;
    await apiFetch(`/api/chat/channels/${activeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refresh();
  };

  const togglePin = async (id: string, pinned: boolean) => {
    await apiFetch(`/api/chat/channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
    refresh();
  };

  const bulkDelete = async (ids: string[]) => {
    await apiFetch("/api/chat/channels/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (activeId && ids.includes(activeId)) setActiveId(null);
    refresh();
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title={t("communication.title")} description={t("communication.description")} />
        {system === "interno" && <NewConversationDialog onStarted={setActiveId} />}
      </div>

      <Tabs value={system} onValueChange={(v) => setSystem(v as "publico" | "interno")}>
        <TabsList>
          <TabsTrigger value="publico">{t("communication.publicChat")}</TabsTrigger>
          <TabsTrigger value="interno">{t("communication.internalChat")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {system === "interno" && (
        <div className="flex gap-2">
          {(["general", "trabajador", "subcontrato", "cliente"] as LabelFilter[]).map((l) => (
            <button
              key={l}
              onClick={() => setLabelFilter(l)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                labelFilter === l ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/70"
              )}
            >
              {t(`communication.labels.${l}`)}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground py-8 text-center">{t("common.loading")}</p>}
      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          {t("common.loadError", { message: error })}
        </div>
      )}

      {!loading && !error && (
        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] h-[560px]">
            <div className="border-b sm:border-b-0 sm:border-r border-border overflow-hidden">
              <ChatList
                channels={channels}
                activeId={activeId}
                onSelect={setActiveId}
                onTogglePin={togglePin}
                onBulkDelete={bulkDelete}
                emptyLabel={system === "publico" ? t("communication.noLeads") : t("communication.noConversations")}
              />
            </div>
            <ChatThread
              channel={activeChannel}
              messages={activeId ? messages ?? null : null}
              ownSenderTypes={["admin", "bot"]}
              onSend={sendMessage}
              onSendFile={async (file) => {
                if (!activeId) return;
                await sendChatAttachment(activeId, file, "");
                reloadMessages();
              }}
              onOpenAttachment={(message) => openChatAttachment(message, "", i18n.language)}
              onUpdateSettings={updateSettings}
              onToggleControlMode={system === "publico" || activeChannel?.label === "cliente" ? toggleControlMode : undefined}
            />
          </div>
        </Card>
      )}

      <AppointmentRequestsPanel />
    </div>
  );
}
