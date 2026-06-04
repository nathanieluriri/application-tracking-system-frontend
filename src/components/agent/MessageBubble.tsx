"use client";

import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import type { ConversationMessage } from "@/lib/agent/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SuggestionChips } from "./SuggestionChips";

interface MessageBubbleProps {
  message: ConversationMessage;
  onPick: (text: string) => void;
  onFeedback: (messageId: string, fb: "up" | "down") => void;
}

export function MessageBubble({
  message,
  onPick,
  onFeedback,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-muted px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
          {message.text}
        </div>
      </div>
    );
  }

  const toolResults = message.tool_results ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-background px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
        {message.text}
      </div>

      {toolResults.length > 0 && (
        <div className="flex flex-col gap-1 pl-1">
          {toolResults.map((tr, i) => (
            <p
              key={`${i}-${tr.tool}`}
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <Check className="h-3 w-3 text-primary" />
              <span>{tr.summary}</span>
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 pl-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Good response"
          aria-pressed={message.feedback === "up"}
          onClick={() => onFeedback(message.id, "up")}
        >
          <ThumbsUp
            className={cn(
              "h-3.5 w-3.5",
              message.feedback === "up"
                ? "text-primary"
                : "text-muted-foreground",
            )}
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Bad response"
          aria-pressed={message.feedback === "down"}
          onClick={() => onFeedback(message.id, "down")}
        >
          <ThumbsDown
            className={cn(
              "h-3.5 w-3.5",
              message.feedback === "down"
                ? "text-primary"
                : "text-muted-foreground",
            )}
          />
        </Button>
      </div>

      {message.suggestions && message.suggestions.length > 0 && (
        <div className="pl-1">
          <SuggestionChips suggestions={message.suggestions} onPick={onPick} />
        </div>
      )}
    </div>
  );
}
