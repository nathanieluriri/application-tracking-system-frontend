import { cn } from "@/lib/utils";
import { positionStatusConfig } from "@/types/position";

interface PositionStatusBadgeProps {
  status: string;
  className?: string;
}

export function PositionStatusBadge({ status, className }: PositionStatusBadgeProps) {
  const cfg = positionStatusConfig(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        cfg.badgeClass,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
