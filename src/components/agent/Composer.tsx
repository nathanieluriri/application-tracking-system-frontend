"use client";

import { useState, type KeyboardEvent } from "react";
import { Loader2, Mic, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ComposerProps {
  onSend: (text: string) => void;
  sending: boolean;
}

export function Composer({ onSend, sending }: ComposerProps) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !sending;

  function submit() {
    if (!canSend) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-border bg-background p-3">
      <div className="rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything…"
          rows={1}
          disabled={sending}
          className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled
              title="Coming soon"
              aria-label="Attach (coming soon)"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled
              title="Coming soon"
              aria-label="Voice input (coming soon)"
            >
              <Mic className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            size="icon"
            className="h-8 w-8"
            disabled={!canSend}
            aria-busy={sending || undefined}
            aria-label="Send message"
            onClick={submit}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
