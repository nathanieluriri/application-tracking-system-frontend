import { z } from "zod";
import { randomUUID } from "node:crypto";
import { nowSeconds } from "./common";

/**
 * Outbound-email schemas, mirrors `schemas/outbound_email_schema.py`.
 */

export const outboundStatusValues = [
  "pending",
  "queued",
  "sent",
  "delivered",
  "bounced",
  "failed",
  "complained",
] as const;
export type OutboundStatus = (typeof outboundStatusValues)[number];

export const outboundRecipientSchema = z.object({
  application_id: z.string().nullable().optional(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
});
export type OutboundRecipientInput = z.infer<typeof outboundRecipientSchema>;

export const outboundEmailCreateSchema = z.object({
  template_id: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  html_body: z.string().nullable().optional(),
  recipients: z.array(outboundRecipientSchema),
});
export type OutboundEmailCreateInput = z.infer<typeof outboundEmailCreateSchema>;

export interface OutboundEmailDoc {
  sender_admin_id: string;
  application_id: string | null;
  template_id: string | null;
  to_email: string;
  to_name: string | null;
  subject_snapshot: string;
  body_snapshot: string;
  status: OutboundStatus;
  resend_email_id: string | null;
  error: string | null;
  queued_at: number | null;
  sent_at: number | null;
  delivered_at: number | null;
  opened_at: number | null;
  clicked_at: number | null;
  task_id: string | null;
  idempotency_key: string;
  date_created: number;
}

export interface OutboundEmailOut {
  id: string | null;
  sender_admin_id: string;
  application_id: string | null;
  template_id: string | null;
  to_email: string;
  to_name: string | null;
  subject_snapshot: string;
  body_snapshot: string;
  status: OutboundStatus;
  resend_email_id: string | null;
  error: string | null;
  queued_at: number | null;
  sent_at: number | null;
  delivered_at: number | null;
  opened_at: number | null;
  clicked_at: number | null;
  task_id: string | null;
  idempotency_key: string;
  date_created: number | null;
}

export interface OutboundEmailCreateArgs {
  sender_admin_id: string;
  application_id?: string | null;
  template_id?: string | null;
  to_email: string;
  to_name?: string | null;
  subject_snapshot: string;
  body_snapshot: string;
}

/** Build a fresh, persistable outbound-email document (status "pending"). */
export function outboundEmailCreateDoc(args: OutboundEmailCreateArgs): OutboundEmailDoc {
  return {
    sender_admin_id: args.sender_admin_id,
    application_id: args.application_id ?? null,
    template_id: args.template_id ?? null,
    to_email: args.to_email,
    to_name: args.to_name ?? null,
    subject_snapshot: args.subject_snapshot,
    body_snapshot: args.body_snapshot,
    status: "pending",
    resend_email_id: null,
    error: null,
    queued_at: null,
    sent_at: null,
    delivered_at: null,
    opened_at: null,
    clicked_at: null,
    task_id: null,
    idempotency_key: `outbound:${randomUUID().replace(/-/g, "")}`,
    date_created: nowSeconds(),
  };
}

export function outboundEmailOut(doc: Record<string, any>): OutboundEmailOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    sender_admin_id: doc.sender_admin_id,
    application_id: doc.application_id ?? null,
    template_id: doc.template_id ?? null,
    to_email: doc.to_email,
    to_name: doc.to_name ?? null,
    subject_snapshot: doc.subject_snapshot,
    body_snapshot: doc.body_snapshot,
    status: doc.status ?? "pending",
    resend_email_id: doc.resend_email_id ?? null,
    error: doc.error ?? null,
    queued_at: doc.queued_at ?? null,
    sent_at: doc.sent_at ?? null,
    delivered_at: doc.delivered_at ?? null,
    opened_at: doc.opened_at ?? null,
    clicked_at: doc.clicked_at ?? null,
    task_id: doc.task_id ?? null,
    idempotency_key: doc.idempotency_key,
    date_created: doc.date_created ?? null,
  };
}
