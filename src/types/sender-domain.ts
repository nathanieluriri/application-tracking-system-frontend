export type SenderDomainStatus = "pending" | "verifying" | "verified" | "failed";

export interface DnsRecord {
  record?: string | null;
  name?: string | null;
  type?: string | null;
  value?: string | null;
  ttl?: string | null;
  priority?: number | null;
  status?: string | null;
}

export interface SenderDomain {
  _id?: string;
  id?: string;
  org_id: string;
  domain: string;
  resend_domain_id?: string | null;
  region?: string | null;
  status: SenderDomainStatus;
  dns_records: DnsRecord[];
  created_by?: string | null;
  date_created: number;
  last_updated: number;
  verified_at?: number | null;
}

/** Normalize the Mongo `_id` / `id` split the backend can return. */
export function domainId(d: SenderDomain): string {
  return d.id ?? d._id ?? "";
}

export const SENDER_DOMAIN_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "eu-west-1", label: "EU West (Ireland)" },
  { value: "sa-east-1", label: "South America (São Paulo)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
] as const;

export const SENDER_DOMAIN_STATUS_CONFIG: Record<
  SenderDomainStatus,
  { label: string; badgeClass: string }
> = {
  pending: {
    label: "Add DNS records",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  verifying: {
    label: "Verifying…",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
  verified: {
    label: "Verified",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  failed: {
    label: "Failed",
    badgeClass: "border-red-200 bg-red-50 text-red-700",
  },
};
