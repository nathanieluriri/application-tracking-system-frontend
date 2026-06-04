"use client";

import { useEffect } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import { useAgentPanel } from "@/lib/agent/store";
import type { AutonomyMode } from "@/lib/agent/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChatThread } from "./ChatThread";
import { HistoryList } from "./HistoryList";

const MODE_LABELS: Record<AutonomyMode, string> = {
  confirm_everything: "Confirm everything",
  smart: "Smart",
  auto_run: "Auto-run",
};

export function AgentPanel() {
  const { open, setOpen, tab, setTab, mode, setMode, newChat } =
    useAgentPanel();

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      {/* Backdrop — visible primarily on mobile; click to close. */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-30 bg-foreground/20 transition-opacity duration-200 motion-reduce:transition-none sm:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Assistant"
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-background shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none sm:w-[400px]",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Assistant</h2>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="New chat"
                title="New chat"
                onClick={newChat}
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Close assistant"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "chat" | "history")}
            >
              <TabsList className="h-8">
                <TabsTrigger value="chat" className="text-xs">
                  Chat
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  History
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Select
              value={mode}
              onValueChange={(v) => setMode(v as AutonomyMode)}
            >
              <SelectTrigger
                className="h-8 w-auto gap-1 text-xs"
                aria-label="Autonomy mode"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirm_everything">
                  {MODE_LABELS.confirm_everything}
                </SelectItem>
                <SelectItem value="smart">{MODE_LABELS.smart}</SelectItem>
                <SelectItem value="auto_run">{MODE_LABELS.auto_run}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1">
          {tab === "chat" ? <ChatThread /> : <HistoryList />}
        </div>
      </aside>
    </>
  );
}
