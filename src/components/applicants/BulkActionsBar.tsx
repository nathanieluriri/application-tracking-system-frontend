"use client";

import { Mail, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBulkUpdateStatus } from "@/lib/query/hooks/applicants";
import { STATUS_ORDER, statusConfig } from "@/types/applicant";

interface BulkActionsBarProps {
  selectedIds: string[];
  onClear: () => void;
}

export function BulkActionsBar({ selectedIds, onClear }: BulkActionsBarProps) {
  const bulkUpdate = useBulkUpdateStatus();
  const count = selectedIds.length;
  if (count === 0) return null;

  async function handleStatus(status: string) {
    try {
      const res = await bulkUpdate.mutateAsync({ ids: selectedIds, status });
      toast.success(
        `Updated ${res.modified ?? selectedIds.length} applicant${
          (res.modified ?? selectedIds.length) === 1 ? "" : "s"
        } to ${statusConfig(status).label}`,
      );
      onClear();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Bulk update failed — try again.",
      );
    }
  }

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur"
    >
      <p className="text-sm font-medium">
        {count} selected
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          onValueChange={handleStatus}
          disabled={bulkUpdate.isPending}
        >
          <SelectTrigger className="w-44" aria-label="Change status">
            <SelectValue placeholder="Change status…" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {statusConfig(s).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/emails/compose?to=${selectedIds.join(",")}`}>
            <Mail className="mr-2 h-4 w-4" aria-hidden />
            Email
          </Link>
        </Button>

        <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear selection">
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
