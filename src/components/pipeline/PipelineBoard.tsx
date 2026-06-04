"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";

import { LoadingOverlay } from "@/components/feedback/LoadingOverlay";
import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import { ApplicantCard } from "@/components/pipeline/ApplicantCard";
import { useApplicants, useUpdateApplicant } from "@/lib/query/hooks/applicants";
import {
  STATUS_ORDER,
  statusConfig,
  getApplicantId,
  type Applicant,
  type ApplicationStatus,
} from "@/types/applicant";

interface PipelineBoardProps {
  initialData?: Applicant[];
}

export function PipelineBoard({ initialData }: PipelineBoardProps) {
  // Load the whole board in one shot, then group client-side.
  const query = useApplicants(
    { start: 0, stop: 500 },
    initialData ? { initialData } : undefined,
  );
  const applicants = query.data ?? [];
  const update = useUpdateApplicant();

  const [activeId, setActiveId] = useState<string | null>(null);

  // Prefer the column under the pointer; fall back to nearest column so a drop
  // in a gap (or a coarse drag) never no-ops or lands on the wrong neighbour.
  const collisionDetection: CollisionDetection = (args) => {
    const within = pointerWithin(args);
    return within.length > 0 ? within : closestCenter(args);
  };

  // A small activation distance lets the grip handle still register clicks
  // (e.g. the name link) without starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const grouped = useMemo(() => {
    const map: Record<string, Applicant[]> = {};
    for (const s of STATUS_ORDER) map[s] = [];
    for (const a of applicants) {
      const key = String(a.status);
      (map[key] ??= []).push(a);
    }
    return map;
  }, [applicants]);

  const activeApplicant = activeId
    ? applicants.find((a) => getApplicantId(a) === activeId) ?? null
    : null;

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const id = String(active.id);
    const targetStatus = String(over.id) as ApplicationStatus;
    const current = applicants.find((a) => getApplicantId(a) === id);
    if (!current || current.status === targetStatus) return;

    update.mutate(
      { id, patch: { status: targetStatus } },
      {
        onSuccess: () =>
          toast.success(`${current.full_name} → ${statusConfig(targetStatus).label}`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Move failed"),
      },
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="relative">
        <LoadingOverlay
          visible={query.isFetching && !query.isLoading && !activeId}
          message="Refreshing…"
        />
        <div className="flex gap-3 overflow-x-auto pb-3">
          {STATUS_ORDER.map((s) => (
            <PipelineColumn key={s} status={s} applicants={grouped[s] ?? []} />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeApplicant ? <ApplicantCard applicant={activeApplicant} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
