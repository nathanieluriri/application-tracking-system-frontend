import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  /**
   * When true, render only the icon — no role/live-region/label. Use inside a
   * component that already provides its own live region (e.g. LoadingOverlay)
   * so screen readers don't announce "Loading" twice.
   */
  decorative?: boolean;
  label?: string;
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

export function Spinner({
  className,
  size = "md",
  decorative = false,
  label = "Loading…",
  ...props
}: SpinnerProps) {
  const icon = (
    <Loader2
      className={cn("animate-spin text-muted-foreground", sizeMap[size], className)}
    />
  );

  // The spinner intentionally keeps spinning under reduced-motion — it is
  // essential, functional feedback (only ambient/decorative motion is suppressed).
  if (decorative) {
    return (
      <div aria-hidden {...props}>
        {icon}
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" {...props}>
      {icon}
      <span className="sr-only">{label}</span>
    </div>
  );
}
