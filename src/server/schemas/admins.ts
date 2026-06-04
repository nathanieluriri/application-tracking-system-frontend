import { z } from "zod";
import { AccountStatus, permissionListSchema, type PermissionList, nowSeconds } from "./common";

/**
 * Admin schemas, mirrors `schemas/admin_schema.py`.
 */

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type AdminLogin = z.infer<typeof adminLoginSchema>;

export const adminSignupSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  // Optional on the wire; defaulted in adminCreateDoc.
  accountStatus: z.nativeEnum(AccountStatus).optional(),
  permissionList: permissionListSchema.nullable().optional(),
});
export type AdminSignup = z.infer<typeof adminSignupSchema>;

export const adminRefreshSchema = z.object({
  refresh_token: z.string().nullable().optional(),
});
export type AdminRefresh = z.infer<typeof adminRefreshSchema>;

export interface AdminDoc {
  full_name: string;
  email: string;
  password: string | null;
  accountStatus: AccountStatus;
  permissionList?: PermissionList | null;
  invited_by?: string;
  date_created: number;
  last_updated: number;
}

export interface AdminOut {
  id: string | null;
  full_name: string;
  email: string;
  password: string | null;
  accountStatus: AccountStatus;
  permissionList: PermissionList | null;
  invited_by: string | null;
  date_created: number | null;
  last_updated: number | null;
  access_token: string | null;
  refresh_token: string | null;
}

export function adminCreateDoc(input: {
  full_name: string;
  email: string;
  passwordHash: string;
  invited_by?: string;
  accountStatus?: AccountStatus;
  permissionList?: PermissionList | null;
}): AdminDoc {
  return {
    full_name: input.full_name,
    email: input.email,
    password: input.passwordHash,
    invited_by: input.invited_by,
    accountStatus: input.accountStatus ?? AccountStatus.ACTIVE,
    permissionList: input.permissionList ?? null,
    date_created: nowSeconds(),
    last_updated: nowSeconds(),
  };
}

export function adminOut(doc: Record<string, any>): AdminOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    full_name: doc.full_name,
    email: doc.email,
    password: doc.password ?? null,
    accountStatus: doc.accountStatus ?? AccountStatus.ACTIVE,
    permissionList: doc.permissionList ?? null,
    invited_by: doc.invited_by ?? null,
    date_created: doc.date_created ?? null,
    last_updated: doc.last_updated ?? null,
    access_token: doc.access_token ?? null,
    refresh_token: doc.refresh_token ?? null,
  };
}

export function publicAdmin(admin: AdminOut): AdminOut {
  return { ...admin, password: null };
}
