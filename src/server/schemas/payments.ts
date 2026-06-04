import { z } from "zod";
import { nowSeconds } from "./common";

/**
 * Payment schemas, mirrors `schemas/payment_schema.py`.
 *
 * Request bodies use `.optional()` (never `.default()`) so `z.infer` input and
 * output types stay aligned; defaults are applied in `paymentTransactionCreateDoc`.
 */

export const paymentIntentInSchema = z.object({
  amount_minor: z.number().int().positive(),
  currency: z.string().min(3).max(3),
  reference: z.string().min(3),
  customer_email: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type PaymentIntentInput = z.infer<typeof paymentIntentInSchema>;

export const refundInSchema = z.object({
  amount_minor: z.number().int().positive().nullable().optional(),
});
export type RefundInput = z.infer<typeof refundInSchema>;

export interface PaymentTransactionDoc {
  owner_id: string;
  provider: string;
  reference: string;
  status: string;
  amount_minor: number;
  currency: string;
  response_payload: Record<string, unknown>;
  idempotency_key: string;
  created_at: number;
  updated_at: number;
}

export interface PaymentTransactionOut {
  id: string | null;
  owner_id: string;
  provider: string;
  reference: string;
  status: string;
  amount_minor: number;
  currency: string;
  response_payload: Record<string, unknown>;
  idempotency_key: string;
  created_at: number;
  updated_at: number;
}

export interface WebhookReplayDoc {
  provider: string;
  event_id: string;
  created_at: number;
}

export function paymentTransactionCreateDoc(input: {
  owner_id: string;
  provider: string;
  reference: string;
  status: string;
  amount_minor: number;
  currency: string;
  response_payload?: Record<string, unknown> | null;
  idempotency_key?: string | null;
}): PaymentTransactionDoc {
  const now = nowSeconds();
  return {
    owner_id: input.owner_id,
    provider: input.provider,
    reference: input.reference,
    status: input.status,
    amount_minor: input.amount_minor,
    currency: input.currency,
    response_payload: input.response_payload ?? {},
    idempotency_key: input.idempotency_key ?? `${input.provider}:${input.reference}`,
    created_at: now,
    updated_at: now,
  };
}

export function webhookReplayCreateDoc(provider: string, eventId: string): WebhookReplayDoc {
  return { provider, event_id: eventId, created_at: nowSeconds() };
}

export function paymentTransactionOut(doc: Record<string, any>): PaymentTransactionOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    owner_id: doc.owner_id,
    provider: doc.provider,
    reference: doc.reference,
    status: doc.status,
    amount_minor: doc.amount_minor,
    currency: doc.currency,
    response_payload: doc.response_payload ?? {},
    idempotency_key: doc.idempotency_key,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}
