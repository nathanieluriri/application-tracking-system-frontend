import { z } from "zod";
import { nowSeconds } from "./common";
import type { DnsRecord, SenderDomainStatus } from "@server/core/email/resend-domains";

/**
 * Sender-domain schemas, mirrors `schemas/sender_domain_schema.py`.
 *
 * Request bodies use `.optional()` (never `.default()`) so `z.infer` input and
 * output types stay aligned; defaults are applied in `senderDomainCreateDoc`.
 */

export const senderDomainCreateSchema = z.object({
  domain: z.string().min(1),
  region: z.string().optional(),
  custom_return_path: z.string().nullable().optional(),
});
export type SenderDomainCreateInput = z.infer<typeof senderDomainCreateSchema>;

export interface SenderDomainDoc {
  org_id: string;
  domain: string;
  resend_domain_id: string | null;
  region: string | null;
  status: SenderDomainStatus;
  dns_records: DnsRecord[];
  created_by: string | null;
  date_created: number;
  last_updated: number;
  verified_at: number | null;
}

export interface SenderDomainOut extends SenderDomainDoc {
  id: string | null;
}

export function senderDomainCreateDoc(input: {
  org_id: string;
  domain: string;
  created_by?: string | null;
  resend_domain_id?: string | null;
  region?: string | null;
  status?: SenderDomainStatus;
  dns_records?: DnsRecord[];
  verified_at?: number | null;
}): SenderDomainDoc {
  const now = nowSeconds();
  return {
    org_id: input.org_id,
    domain: input.domain,
    resend_domain_id: input.resend_domain_id ?? null,
    region: input.region ?? null,
    status: input.status ?? "pending",
    dns_records: input.dns_records ?? [],
    created_by: input.created_by ?? null,
    date_created: now,
    last_updated: now,
    verified_at: input.verified_at ?? null,
  };
}

export function senderDomainOut(doc: Record<string, any>): SenderDomainOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    org_id: doc.org_id,
    domain: doc.domain,
    resend_domain_id: doc.resend_domain_id ?? null,
    region: doc.region ?? null,
    status: doc.status ?? "pending",
    dns_records: doc.dns_records ?? [],
    created_by: doc.created_by ?? null,
    date_created: doc.date_created ?? null,
    last_updated: doc.last_updated ?? null,
    verified_at: doc.verified_at ?? null,
  };
}
