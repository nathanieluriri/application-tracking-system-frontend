import { cn } from "@/lib/utils";
import { statusConfig } from "@/types/applicant";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = statusConfig(status);
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
