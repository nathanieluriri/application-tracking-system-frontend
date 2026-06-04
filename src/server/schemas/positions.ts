import { z } from "zod";
import { nowSeconds } from "./common";

/**
 * Position schemas, mirrors `schemas/position_schema.py`.
 */

export const positionStatusValues = ["open", "closed", "draft"] as const;
export const employmentTypeValues = [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "temporary",
] as const;

export const positionCreateSchema = z.object({
  title: z.string().min(1),
  department: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  // Optional on the wire; `positionCreateDoc` defaults these.
  employment_type: z.enum(employmentTypeValues).optional(),
  description: z.string().nullable().optional(),
  requirements: z.array(z.string()).nullable().optional(),
  status: z.enum(positionStatusValues).optional(),
  process_template_id: z.string().nullable().optional(),
});
export type PositionCreateInput = z.infer<typeof positionCreateSchema>;

export const positionUpdateSchema = z.object({
  title: z.string().optional(),
  department: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  employment_type: z.enum(employmentTypeValues).optional(),
  description: z.string().nullable().optional(),
  requirements: z.array(z.string()).nullable().optional(),
  status: z.enum(positionStatusValues).optional(),
  process_template_id: z.string().nullable().optional(),
});
export type PositionUpdateInput = z.infer<typeof positionUpdateSchema>;

export interface PositionDoc {
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string;
  description: string | null;
  requirements: string[] | null;
  status: string;
  process_template_id: string | null;
  created_by: string;
  date_created: number;
  last_updated: number;
}

export interface PositionOut {
  id: string | null;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string;
  description: string | null;
  requirements: string[] | null;
  status: string;
  process_template_id: string | null;
  created_by: string | null;
  date_created: number | null;
  last_updated: number | null;
}

export function positionCreateDoc(input: PositionCreateInput, createdBy: string): PositionDoc {
  return {
    title: input.title,
    department: input.department ?? null,
    location: input.location ?? null,
    employment_type: input.employment_type ?? "full_time",
    description: input.description ?? null,
    requirements: input.requirements ?? null,
    status: input.status ?? "open",
    process_template_id: input.process_template_id ?? null,
    created_by: createdBy,
    date_created: nowSeconds(),
    last_updated: nowSeconds(),
  };
}

export function positionOut(doc: Record<string, any>): PositionOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    title: doc.title,
    department: doc.department ?? null,
    location: doc.location ?? null,
    employment_type: doc.employment_type ?? "full_time",
    description: doc.description ?? null,
    requirements: doc.requirements ?? null,
    status: doc.status ?? "open",
    process_template_id: doc.process_template_id ?? null,
    created_by: doc.created_by ?? null,
    date_created: doc.date_created ?? null,
    last_updated: doc.last_updated ?? null,
  };
}
