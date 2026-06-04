export type ApplicationStatus =
  | "new"
  | "reviewing"
  | "shortlisted"
  | "interview"
  | "offered"
  | "accepted"
  | "rejected";

export interface Applicant {
  id?: string;
  _id?: string;
  full_name: string;
  email: string;
  phone?: string | null;
  position_id: string;
  position_title?: string | null;
  status: ApplicationStatus | string;
  applied_date?: number | null;
  experience?: string | null;
  location?: string | null;
  cv_document_id?: string | null;
  rating?: number;
  notes?: string;
  date_created?: number | null;
  last_updated?: number | null;
}

export const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; badgeClass: string; order: number }
> = {
  new: {
    label: "New",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    order: 1,
  },
  reviewing: {
    label: "Reviewing",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    order: 2,
  },
  shortlisted: {
    label: "Shortlisted",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200",
    order: 3,
  },
  interview: {
    label: "Interview",
    badgeClass: "bg-primary/10 text-primary border-primary/20",
    order: 4,
  },
  offered: {
    label: "Offered",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    order: 5,
  },
  accepted: {
    label: "Accepted",
    badgeClass: "bg-green-100 text-green-800 border-green-200",
    order: 6,
  },
  rejected: {
    label: "Rejected",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    order: 7,
  },
};

export const STATUS_ORDER: ApplicationStatus[] = [
  "new",
  "reviewing",
  "shortlisted",
  "interview",
  "offered",
  "accepted",
  "rejected",
];

export function getApplicantId(a: Applicant): string {
  return a.id ?? a._id ?? "";
}

export function statusConfig(status: string) {
  return (
    STATUS_CONFIG[status as ApplicationStatus] ?? {
      label: status,
      badgeClass: "bg-muted text-muted-foreground border-border",
      order: 99,
    }
  );
}
