"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApplicantId, type Applicant } from "@/types/applicant";

interface ApplicantCardProps {
  applicant: Applicant;
  /** Rendered inside <DragOverlay> — non-interactive, no drag wiring. */
  overlay?: boolean;
}

export function ApplicantCard({ applicant, overlay }: ApplicantCardProps) {
  const id = getApplicantId(applicant);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      className={cn(
        "group rounded-lg border border-border bg-card p-2.5 shadow-[0_1px_2px_rgba(9,30,66,0.08)] transition",
        !overlay &&
          "hover:border-foreground/20 hover:shadow-[0_4px_10px_rgba(9,30,66,0.12)]",
        isDragging && !overlay && "opacity-40",
        overlay &&
          "rotate-2 cursor-grabbing shadow-[0_10px_20px_rgba(9,30,66,0.22)] ring-1 ring-border",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          aria-label={`Drag ${applicant.full_name}`}
          className="mt-0.5 cursor-grab touch-none text-muted-foreground/50 opacity-60 transition-opacity hover:text-foreground focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          {overlay ? (
            <span className="block truncate text-sm font-medium text-foreground">
              {applicant.full_name}
            </span>
          ) : (
            <Link
              href={`/dashboard/applicants/${id}`}
              className="block truncate text-sm font-medium text-foreground hover:underline"
            >
              {applicant.full_name}
            </Link>
          )}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {applicant.position_title ?? "—"}
            </span>
            {applicant.rating ? (
              <span
                className="shrink-0 text-[11px] text-amber-500"
                aria-label={`Rating ${applicant.rating} of 5`}
              >
                {"★".repeat(applicant.rating)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
