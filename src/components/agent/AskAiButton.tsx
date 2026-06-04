"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentPanel } from "@/lib/agent/store";

export function AskAiButton() {
  const { toggle, open } = useAgentPanel();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full"
      aria-expanded={open}
      aria-label="Ask AI"
      onClick={toggle}
    >
      <Sparkles className="h-4 w-4" />
      <span>Ask AI</span>
    </Button>
  );
}
