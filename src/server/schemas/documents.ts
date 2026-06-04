import { z } from "zod";

/**
 * Document schemas, mirrors `schemas/document_schema.py`.
 */

export const uploadIntentRequestSchema = z.object({
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
  size: z.number().int().positive(),
});
export type UploadIntentRequest = z.infer<typeof uploadIntentRequestSchema>;

export const completeUploadRequestSchema = z.object({
  object_key: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  size: z.number().int().positive(),
  checksum: z.string().nullable().optional(),
});
export type CompleteUploadRequest = z.infer<typeof completeUploadRequestSchema>;

export interface DocumentDoc {
  owner_id: string;
  file_name: string;
  object_key: string;
  backend: string;
  mime_type: string;
  size: number;
  checksum: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: number;
  updated_at: number;
}

export interface DocumentOut extends DocumentDoc {
  id: string | null;
}

export function documentOut(doc: Record<string, any>): DocumentOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    owner_id: doc.owner_id,
    file_name: doc.file_name,
    object_key: doc.object_key,
    backend: doc.backend,
    mime_type: doc.mime_type,
    size: doc.size,
    checksum: doc.checksum ?? null,
    status: doc.status ?? "ready",
    metadata: doc.metadata ?? null,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}
