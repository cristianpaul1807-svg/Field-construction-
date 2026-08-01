import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, Pin, Trash2, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatChannel } from "@/lib/chatApi";

const MAX_SELECTION = 5;
const LONG_PRESS_MS = 500;

function initials(name: string | null | undefined) {
  return (name ?? "?").trim().charAt(0).toUpperCase() || "?";
}

interface ChatListProps {
  channels: ChatChannel[] | null;
  activeId: string | null;
  onSelect: (id: string) => void;
  onTogglePin?: (id: string, pinned: boolean) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  emptyLabel?: string;
}

export function ChatList({ channels, activeId, onSelect, onTogglePin, onBulkDelete, emptyLabel }: ChatListProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justEnteredSelection = useRef(false);
  const selectionEnabled = Boolean(onTogglePin || onBulkDelete);

  const filtered = (channels ?? []).filter((c) =>
    (c.participantName ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const active = filtered.filter((c) => !c.archived);
  const archived = filtered.filter((c) => c.archived);

  const inSelectionMode = selected.length > 0;

  const startPress = (id: string) => {
    if (!selectionEnabled) return;
    pressTimer.current = setTimeout(() => {
      setSelected([id]);
      justEnteredSelection.current = true;
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECTION) return prev;
      return [...prev, id];
    });
  };

  const handleClick = (id: string) => {
    if (justEnteredSelection.current) {
      justEnteredSelection.current = false;
      return;
    }
    if (inSelectionMode) toggleSelect(id);
    else onSelect(id);
  };

  const renderItem = (channel: ChatChannel) => {
    const isSelected = selected.includes(channel.id);
    return (
      <button
        key={channel.id}
        onPointerDown={() => startPress(channel.id)}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onClick={() => handleClick(channel.id)}
        className={cn(
          "w-full text-left px-4 py-3 border-b border-border flex items-center gap-3 transition-colors",
          channel.id === activeId && !inSelectionMode ? "bg-secondary" : "hover:bg-secondary/60",
          isSelected && "bg-primary/10"
        )}
      >
        {inSelectionMode && (
          <div
            className={cn(
              "w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center",
              isSelected ? "bg-primary border-primary" : "border-input"
            )}
          >
            {isSelected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
          </div>
        )}
        <Avatar>
          {channel.participantAvatarUrl && <AvatarImage src={channel.participantAvatarUrl} />}
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
            {initials(channel.participantName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-foreground truncate">{channel.participantName ?? "Sin nombre"}</p>
            {channel.pinned && <Pin size={11} className="text-muted-foreground flex-shrink-0" />}
            {channel.status === "invitado" && (
              <span className="text-[10px] text-status-warning-fg flex-shrink-0">Invitado</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{channel.lastMessage ?? "Sin mensajes todavía"}</p>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {inSelectionMode ? (
        <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 bg-secondary/60">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected([])} className="text-muted-foreground">
              <X size={16} />
            </button>
            <span className="text-sm text-foreground">{selected.length} seleccionado(s)</span>
          </div>
          <div className="flex items-center gap-1">
            {onTogglePin && selected.length === 1 && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  const channel = channels?.find((c) => c.id === selected[0]);
                  if (channel) onTogglePin(channel.id, !channel.pinned);
                  setSelected([]);
                }}
              >
                <Pin size={16} />
              </Button>
            )}
            {onBulkDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="text-status-error-fg"
                onClick={async () => {
                  await onBulkDelete(selected);
                  setSelected([]);
                }}
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {active.map(renderItem)}
        {active.length === 0 && (
          <p className="p-4 text-xs text-muted-foreground">{emptyLabel ?? "Sin chats todavía."}</p>
        )}

        {archived.length > 0 && (
          <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen}>
            <CollapsibleTrigger className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground hover:bg-secondary/40">
              Archivados ({archived.length})
              <ChevronDown size={14} className={cn("transition-transform", archivedOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>{archived.map(renderItem)}</CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
