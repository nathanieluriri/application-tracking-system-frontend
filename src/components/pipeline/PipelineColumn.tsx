"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { statusConfig, getApplicantId, type Applicant } from "@/types/applicant";
import { ApplicantCard } from "@/components/pipeline/ApplicantCard";

interface PipelineColumnProps {
  status: string;
  applicants: Applicant[];
}

export function PipelineColumn({ status, applicants }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cfg = statusConfig(status);

  return (
    <div ref={setNodeRef} className="flex w-[272px] shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1.5">
        <span
          className={cn(
            "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
            cfg.badgeClass,
          )}
        >
          {cfg.label}
        </span>
        <span className="rounded bg-background px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {applicants.length}
        </span>
      </div>

      <div
        className={cn(
          "flex max-h-[calc(100vh-12rem)] min-h-[88px] flex-col gap-2 overflow-y-auto rounded-xl bg-muted p-2 transition-colors",
          isOver && "bg-secondary ring-2 ring-primary/40",
        )}
      >
        {applicants.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {isOver ? "Release to move here" : "No applicants"}
          </p>
        ) : null}
        {applicants.map((a) => (
          <ApplicantCard key={getApplicantId(a)} applicant={a} />
        ))}
      </div>
    </div>
  );
}
