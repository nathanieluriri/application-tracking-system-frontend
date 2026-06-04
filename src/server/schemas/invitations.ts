import { z } from "zod";
import { permissionListSchema, type PermissionList, nowSeconds } from "./common";

/**
 * Invitation schemas, mirrors `schemas/invitation_schema.py`.
 */

export const invitationStatusValues = ["pending", "accepted", "revoked", "expired"] as const;
export type InvitationStatus = (typeof invitationStatusValues)[number];

export const invitationCreateSchema = z.object({
  invitee_email: z.string().email(),
  // Optional on the wire; `invitationCreateDoc` defaults this.
  role: z.literal("admin").optional(),
  permission_overrides: permissionListSchema.nullable().optional(),
  note: z.string().nullable().optional(),
});
export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;

export const invitationAcceptSchema = z.object({
  token: z.string().min(10),
  full_name: z.string().min(1),
  password: z.string().min(1),
});
export type InvitationAcceptInput = z.infer<typeof invitationAcceptSchema>;

export interface InvitationDoc {
  invitee_email: string;
  invited_by: string;
  role: string;
  permission_overrides: PermissionList | null;
  note: string | null;
  token_hash: string;
  status: InvitationStatus;
  expires_at: number;
  date_created: number;
  accepted_at: number | null;
  accepted_admin_id: string | null;
}

export interface InvitationOut {
  id: string | null;
  invitee_email: string;
  invited_by: string;
  role: string;
  permission_overrides: PermissionList | null;
  note: string | null;
  token_hash: string;
  status: InvitationStatus;
  expires_at: number | null;
  date_created: number | null;
  accepted_at: number | null;
  accepted_admin_id: string | null;
}

/** Public verify payload, mirrors the dict returned by `verify_invitation_token`. */
export interface InvitationVerifyOut {
  invitee_email: string;
  invited_by: string;
  role: string;
  expires_at: number;
}

export function invitationCreateDoc(input: {
  invitee_email: string;
  invited_by: string;
  role?: string;
  permission_overrides?: PermissionList | null;
  note?: string | null;
  token_hash: string;
  expires_at: number;
}): InvitationDoc {
  return {
    invitee_email: input.invitee_email,
    invited_by: input.invited_by,
    role: input.role ?? "admin",
    permission_overrides: input.permission_overrides ?? null,
    note: input.note ?? null,
    token_hash: input.token_hash,
    status: "pending",
    expires_at: input.expires_at,
    date_created: nowSeconds(),
    accepted_at: null,
    accepted_admin_id: null,
  };
}

export function invitationOut(doc: Record<string, any>): InvitationOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    invitee_email: doc.invitee_email,
    invited_by: doc.invited_by,
    role: doc.role ?? "admin",
    permission_overrides: doc.permission_overrides ?? null,
    note: doc.note ?? null,
    token_hash: doc.token_hash,
    status: doc.status ?? "pending",
    expires_at: doc.expires_at ?? null,
    date_created: doc.date_created ?? null,
    accepted_at: doc.accepted_at ?? null,
    accepted_admin_id: doc.accepted_admin_id ?? null,
  };
}
