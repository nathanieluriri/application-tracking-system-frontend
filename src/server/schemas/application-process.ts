import { z } from "zod";
import { nowSeconds } from "./common";

/**
 * Application-process (pipeline) schemas, mirrors
 * `schemas/application_process_schema.py`.
 */

export const stageSchema = z.object({
  key: z.string(),
  label: z.string(),
  order: z.number().int(),
  color: z.string().nullable().optional(),
  requires_email: z.boolean().optional(),
  email_template_id: z.string().nullable().optional(),
  terminal: z.boolean().optional(),
});
export type Stage = z.infer<typeof stageSchema>;

export const applicationProcessCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  stages: z.array(stageSchema),
  require_cv: z.boolean().optional(),
  auto_acknowledge: z.boolean().optional(),
  is_system: z.boolean().optional(),
});
export type ApplicationProcessCreateInput = z.infer<typeof applicationProcessCreateSchema>;

export const applicationProcessUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  stages: z.array(stageSchema).optional(),
  require_cv: z.boolean().optional(),
  auto_acknowledge: z.boolean().optional(),
});
export type ApplicationProcessUpdateInput = z.infer<typeof applicationProcessUpdateSchema>;

export interface ApplicationProcessDoc {
  name: string;
  description: string | null;
  stages: Stage[];
  require_cv: boolean;
  auto_acknowledge: boolean;
  is_system: boolean;
  created_by: string | null;
  date_created: number;
  last_updated: number;
}

export interface ApplicationProcessOut extends ApplicationProcessDoc {
  id: string | null;
}

export function applicationProcessCreateDoc(
  input: ApplicationProcessCreateInput,
  createdBy: string | null = null,
): ApplicationProcessDoc {
  return {
    name: input.name,
    description: input.description ?? null,
    stages: input.stages.map((s) => ({
      ...s,
      requires_email: s.requires_email ?? false,
      terminal: s.terminal ?? false,
    })),
    require_cv: input.require_cv ?? true,
    auto_acknowledge: input.auto_acknowledge ?? true,
    is_system: input.is_system ?? false,
    created_by: createdBy,
    date_created: nowSeconds(),
    last_updated: nowSeconds(),
  };
}

export function applicationProcessOut(doc: Record<string, any>): ApplicationProcessOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    name: doc.name,
    description: doc.description ?? null,
    stages: doc.stages ?? [],
    require_cv: doc.require_cv ?? true,
    auto_acknowledge: doc.auto_acknowledge ?? true,
    is_system: doc.is_system ?? false,
    created_by: doc.created_by ?? null,
    date_created: doc.date_created ?? null,
    last_updated: doc.last_updated ?? null,
  };
}

export const DEFAULT_STAGES: Stage[] = [
  { key: "new", label: "New", order: 1, color: "info", requires_email: false, terminal: false },
  { key: "reviewing", label: "Reviewing", order: 2, color: "warning", requires_email: false, terminal: false },
  { key: "shortlisted", label: "Shortlisted", order: 3, color: "accent", requires_email: false, terminal: false },
  { key: "interview", label: "Interview", order: 4, color: "primary", requires_email: true, terminal: false },
  { key: "offered", label: "Offered", order: 5, color: "success", requires_email: true, terminal: false },
  { key: "accepted", label: "Accepted", order: 6, color: "success", requires_email: false, terminal: true },
  { key: "rejected", label: "Rejected", order: 7, color: "destructive", requires_email: true, terminal: true },
];
