import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

export function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  return (
    <div role="status" aria-live="polite" {...props}>
      <Loader2 className={cn("animate-spin text-muted-foreground", sizeMap[size], className)} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
