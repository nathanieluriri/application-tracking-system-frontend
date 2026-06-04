"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConversations, useDeleteConversation } from "@/lib/agent/hooks";
import { useAgentPanel } from "@/lib/agent/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AgentSkeleton } from "./AgentSkeleton";

function relativeTime(ts: number | null): string {
  if (!ts) return "";
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return "";
  }
}

export function HistoryList() {
  const { setConversationId, setTab } = useAgentPanel();
  const { data, isLoading, isError } = useConversations();
  const deleteMutation = useDeleteConversation();
  // Row id awaiting delete confirmation (two-tap confirm on the trash button).
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (isLoading) return <AgentSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
        Couldn&apos;t load your conversations.
      </div>
    );
  }

  const conversations = data ?? [];

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
        No conversations yet
      </div>
    );
  }

  function openConversation(id: string) {
    setConversationId(id);
    setTab("chat");
  }

  function handleDelete(id: string) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setConfirmingId(null);
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success("Conversation deleted."),
      onError: () => toast.error("Couldn't delete the conversation."),
    });
  }

  return (
    <ScrollArea className="h-full">
      <ul className="flex flex-col gap-1 p-2">
        {conversations.map((c) => {
          const confirming = confirmingId === c.id;
          return (
            <li
              key={c.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted"
            >
              <button
                type="button"
                onClick={() => openConversation(c.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {c.title || "Untitled conversation"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {relativeTime(c.last_updated)}
                  </span>
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0",
                  confirming && "text-destructive",
                )}
                aria-label={
                  confirming ? "Confirm delete conversation" : "Delete conversation"
                }
                title={confirming ? "Tap again to confirm" : "Delete"}
                onClick={() => handleDelete(c.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
