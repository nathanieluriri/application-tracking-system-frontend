// Mirrors PositionOut + positionStatusValues + employmentTypeValues from
// src/server/schemas/positions.ts. Client-safe (no server imports).

export const positionStatusValues = ["open", "closed", "draft"] as const;
export const employmentTypeValues = [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "temporary",
] as const;

export type PositionStatus = (typeof positionStatusValues)[number];
export type EmploymentType = (typeof employmentTypeValues)[number];

export interface Position {
  id?: string | null;
  _id?: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: EmploymentType | string;
  description: string | null;
  requirements: string[] | null;
  status: PositionStatus | string;
  process_template_id: string | null;
  created_by: string | null;
  date_created: number | null;
  last_updated: number | null;
}

/** Order used in selects and filters. */
export const POSITION_STATUS_ORDER: PositionStatus[] = ["open", "draft", "closed"];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

const POSITION_STATUS_CONFIG: Record<
  PositionStatus,
  { label: string; badgeClass: string }
> = {
  open: { label: "Open", badgeClass: "bg-green-100 text-green-800 border-green-200" },
  draft: { label: "Draft", badgeClass: "bg-amber-100 text-amber-800 border-amber-200" },
  closed: { label: "Closed", badgeClass: "bg-red-100 text-red-800 border-red-200" },
};

export function getPositionId(p: Position): string {
  return (p.id ?? p._id ?? "").toString();
}

export function positionStatusConfig(status: string) {
  return (
    POSITION_STATUS_CONFIG[status as PositionStatus] ?? {
      label: status,
      badgeClass: "bg-muted text-muted-foreground border-border",
    }
  );
}

export function employmentTypeLabel(type: string): string {
  return EMPLOYMENT_TYPE_LABELS[type as EmploymentType] ?? type;
}
