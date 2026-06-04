"use client";

import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/feedback/Spinner";
import { cn } from "@/lib/utils";
import type { UploadStatus } from "@/hooks/useUploadWithProgress";

interface UploadProgressProps {
  fileName?: string;
  progress: number;
  determinate: boolean;
  status: UploadStatus;
  error?: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

/**
 * Design-system-styled upload progress card for dashboard surfaces. Pair with
 * useUploadWithProgress. (Public/marketing pages with bespoke styling can use the
 * headless hook directly and render their own bar.)
 */
export function UploadProgress({
  fileName,
  progress,
  determinate,
  status,
  error,
  onCancel,
  onRetry,
  className,
}: UploadProgressProps) {
  const isUploading = status === "uploading";
  const label =
    status === "success"
      ? "Done"
      : status === "error"
        ? "Failed"
        : status === "canceled"
          ? "Canceled"
          : determinate
            ? `${progress}%`
            : "Uploading…";

  return (
    <div className={cn("space-y-3 rounded-lg border p-4", className)} aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {isUploading ? <Spinner size="sm" decorative /> : null}
          <span className="truncate text-sm font-medium">{fileName ?? "File"}</span>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      </div>

      <Progress
        value={determinate ? progress : undefined}
        className={cn(status === "error" && "[&>div]:bg-destructive")}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {(isUploading && onCancel) || (status === "error" && onRetry) ? (
        <div className="flex justify-end gap-2">
          {isUploading && onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {status === "error" && onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
