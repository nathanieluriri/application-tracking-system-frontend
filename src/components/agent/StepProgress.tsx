"use client";

import { Check, Loader2 } from "lucide-react";
import type { Step } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

interface StepProgressProps {
  steps: Step[] | string[];
  active?: boolean;
}

function normalize(steps: Step[] | string[]): string[] {
  return steps.map((s) => (typeof s === "string" ? s : s.label));
}

export function StepProgress({ steps, active = false }: StepProgressProps) {
  const labels = normalize(steps);
  if (labels.length === 0) return null;

  const lastIndex = labels.length - 1;

  return (
    <ol className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
      {labels.map((label, i) => {
        // While active, the last step is the one in flight (spinner); earlier
        // steps are considered complete. When not active, everything is done.
        const isRunning = active && i === lastIndex;
        return (
          <li
            key={`${i}-${label}`}
            className={cn(
              "flex items-center gap-2 text-sm",
              isRunning ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none" />
              ) : (
                <Check className="h-4 w-4 text-primary" />
              )}
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
