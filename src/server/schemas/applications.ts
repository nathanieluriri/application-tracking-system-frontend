import { z } from "zod";
import { nowSeconds } from "./common";

/**
 * Application schemas, mirrors `schemas/application_schema.py`.
 */

export const applicationUpdateSchema = z.object({
  status: z.string().nullable().optional(),
  rating: z.number().int().min(0).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
  cv_document_id: z.string().nullable().optional(),
});
export type ApplicationUpdateInput = z.infer<typeof applicationUpdateSchema>;

export const bulkStatusUpdateSchema = z.object({
  ids: z.array(z.string()),
  status: z.string(),
});
export type BulkStatusUpdateInput = z.infer<typeof bulkStatusUpdateSchema>;

/** Text fields of the public application submit form (multipart). */
export const publicSubmitSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  position_id: z.string().min(1),
  phone: z.string().optional().nullable(),
  experience: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  captcha_token: z.string().optional().nullable(),
});
export type PublicSubmitInput = z.infer<typeof publicSubmitSchema>;

export interface ApplicationCreate {
  full_name: string;
  email: string;
  phone: string | null;
  position_id: string;
  experience: string | null;
  location: string | null;
  cv_document_id: string | null;
  status: string;
  rating: number;
  notes: string;
  applied_date: number;
  process_template_id: string | null;
  date_created: number;
  last_updated: number;
}

export interface ApplicationOut {
  id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  position_id: string;
  status: string;
  applied_date: number | null;
  experience: string | null;
  location: string | null;
  cv_document_id: string | null;
  rating: number;
  notes: string;
  position_title: string | null;
  process_template_id: string | null;
  date_created: number | null;
  last_updated: number | null;
}

export interface StatusHistoryEntry {
  application_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  changed_at: number;
}

export function applicationCreate(input: {
  full_name: string;
  email: string;
  phone?: string | null;
  position_id: string;
  experience?: string | null;
  location?: string | null;
  cv_document_id?: string | null;
  status: string;
  process_template_id?: string | null;
}): ApplicationCreate {
  return {
    full_name: input.full_name,
    email: input.email,
    phone: input.phone ?? null,
    position_id: input.position_id,
    experience: input.experience ?? null,
    location: input.location ?? null,
    cv_document_id: input.cv_document_id ?? null,
    status: input.status,
    rating: 0,
    notes: "",
    applied_date: nowSeconds(),
    process_template_id: input.process_template_id ?? null,
    date_created: nowSeconds(),
    last_updated: nowSeconds(),
  };
}

export function statusHistoryEntry(input: {
  application_id: string;
  from_status: string | null;
  to_status: string;
  changed_by?: string | null;
}): StatusHistoryEntry {
  return {
    application_id: input.application_id,
    from_status: input.from_status,
    to_status: input.to_status,
    changed_by: input.changed_by ?? null,
    changed_at: nowSeconds(),
  };
}

export function applicationOut(doc: Record<string, any>): ApplicationOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    full_name: doc.full_name,
    email: doc.email,
    phone: doc.phone ?? null,
    position_id: doc.position_id,
    status: doc.status ?? "new",
    applied_date: doc.applied_date ?? null,
    experience: doc.experience ?? null,
    location: doc.location ?? null,
    cv_document_id: doc.cv_document_id ?? null,
    rating: doc.rating ?? 0,
    notes: doc.notes ?? "",
    position_title: doc.position_title ?? null,
    process_template_id: doc.process_template_id ?? null,
    date_created: doc.date_created ?? null,
    last_updated: doc.last_updated ?? null,
  };
}
