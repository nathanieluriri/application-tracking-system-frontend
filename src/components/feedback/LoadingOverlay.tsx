"use client";

import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";

interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  visible: boolean;
  message?: string;
  /** Delay before showing while visible (anti-flash). Default 200ms. */
  delay?: number;
  /** Minimum time shown once visible (anti-flicker). Default 400ms. */
  minDuration?: number;
}

export function LoadingOverlay({
  visible,
  message,
  delay,
  minDuration,
  className,
  ...props
}: LoadingOverlayProps) {
  const show = useDelayedFlag(visible, { delay, minDuration });
  if (!show) return null;
  return (
    <div
      aria-busy="true"
      className={cn(
        "absolute inset-0 z-10 grid place-items-center rounded-lg bg-background/60 backdrop-blur-sm",
        className,
      )}
      {...props}
    >
      {/* Single live region — the inner Spinner is decorative so it isn't announced twice. */}
      <div className="flex flex-col items-center gap-2" role="status" aria-live="polite">
        <Spinner size="md" decorative />
        {message ? (
          <span className="text-sm text-muted-foreground">{message}</span>
        ) : (
          <span className="sr-only">Loading…</span>
        )}
      </div>
    </div>
  );
}
