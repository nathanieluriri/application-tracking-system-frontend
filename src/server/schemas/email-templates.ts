import { z } from "zod";
import { nowSeconds } from "./common";

/**
 * Email-template schemas, mirrors `schemas/email_template_schema.py`.
 */

const templateTypeValues = ["acceptance", "rejection", "interview", "custom"] as const;

const templateVariableSchema = z.object({
  key: z.string(),
  type: z.enum(["string", "number"]).optional(),
  fallback_value: z.union([z.string(), z.number()]).nullable().optional(),
});

export const emailTemplateCreateSchema = z.object({
  name: z.string().min(1),
  alias: z.string().nullable().optional(),
  subject: z.string(),
  html_body: z.string(),
  text_body: z.string().nullable().optional(),
  type: z.enum(templateTypeValues).optional(),
  variables: z.array(templateVariableSchema).optional(),
  is_system: z.boolean().optional(),
});
export type EmailTemplateCreateInput = z.infer<typeof emailTemplateCreateSchema>;

export const emailTemplateUpdateSchema = z.object({
  name: z.string().optional(),
  alias: z.string().nullable().optional(),
  subject: z.string().optional(),
  html_body: z.string().optional(),
  text_body: z.string().nullable().optional(),
  type: z.enum(templateTypeValues).optional(),
  variables: z.array(templateVariableSchema).optional(),
});
export type EmailTemplateUpdateInput = z.infer<typeof emailTemplateUpdateSchema>;

export interface EmailTemplateDoc {
  name: string;
  alias: string | null;
  subject: string;
  html_body: string;
  text_body: string | null;
  type: string;
  variables: unknown[];
  is_system: boolean;
  created_by: string | null;
  date_created: number;
  last_updated: number;
}

export interface EmailTemplateOut extends EmailTemplateDoc {
  id: string | null;
  resend_template_id: string | null;
}

export function emailTemplateCreateDoc(
  input: EmailTemplateCreateInput,
  createdBy: string | null,
): EmailTemplateDoc {
  return {
    name: input.name,
    alias: input.alias ?? null,
    subject: input.subject,
    html_body: input.html_body,
    text_body: input.text_body ?? null,
    type: input.type ?? "custom",
    variables: input.variables ?? [],
    is_system: input.is_system ?? false,
    created_by: createdBy,
    date_created: nowSeconds(),
    last_updated: nowSeconds(),
  };
}

export function emailTemplateOut(doc: Record<string, any>): EmailTemplateOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    name: doc.name,
    alias: doc.alias ?? null,
    subject: doc.subject,
    html_body: doc.html_body,
    text_body: doc.text_body ?? null,
    type: doc.type ?? "custom",
    variables: doc.variables ?? [],
    is_system: doc.is_system ?? false,
    resend_template_id: doc.resend_template_id ?? null,
    created_by: doc.created_by ?? null,
    date_created: doc.date_created ?? null,
    last_updated: doc.last_updated ?? null,
  };
}
