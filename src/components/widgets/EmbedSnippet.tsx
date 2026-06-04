"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { generateSnippet } from "@/lib/widget/snippet";
import { Button } from "@/components/ui/button";

export function EmbedSnippet({ widgetId }: { widgetId: string }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const snippet = generateSnippet({ origin, widgetId });

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  }

  return (
    <div className="rounded-lg border bg-muted/40">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Embed snippet</span>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto px-3 py-3 text-xs leading-relaxed text-muted-foreground">
        <code>{snippet}</code>
      </pre>
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        Paste this anywhere on your site. Edits here go live automatically — no need to re-paste.
      </p>
    </div>
  );
}
