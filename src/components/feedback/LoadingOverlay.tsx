import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({
  visible,
  message,
  className,
  ...props
}: LoadingOverlayProps) {
  if (!visible) return null;
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "absolute inset-0 z-10 grid place-items-center rounded-lg bg-background/60 backdrop-blur-sm",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col items-center gap-2">
        <Spinner size="md" />
        {message ? (
          <span className="text-sm text-muted-foreground">{message}</span>
        ) : null}
      </div>
    </div>
  );
}
