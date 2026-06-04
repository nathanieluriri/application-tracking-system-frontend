import { z } from "zod";
import {
  AccountStatus,
  LoginType,
  permissionListSchema,
  type PermissionList,
  nowSeconds,
} from "./common";

/**
 * User schemas, mirrors `schemas/user_schema.py`. Password hashing happens in
 * the repository (async bcrypt) rather than a schema validator.
 */

export const userSignupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  // Optional on the wire; the service defaults it to EMAIL.
  loginType: z.nativeEnum(LoginType).optional(),
});
export type UserSignup = z.infer<typeof userSignupSchema>;

export const userLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type UserLogin = z.infer<typeof userLoginSchema>;

export const userRefreshSchema = z.object({
  refresh_token: z.string().nullable().optional(),
});
export type UserRefresh = z.infer<typeof userRefreshSchema>;

export interface UserDoc {
  firstName: string;
  lastName: string;
  loginType: LoginType;
  email: string;
  password: string | null;
  accountStatus: AccountStatus;
  permissionList?: PermissionList | null;
  date_created: number;
  last_updated: number;
}

export interface UserOut {
  id: string | null;
  firstName: string;
  lastName: string;
  loginType: LoginType;
  email: string;
  password: string | null;
  accountStatus: AccountStatus;
  permissionList: PermissionList | null;
  date_created: number | null;
  last_updated: number | null;
  access_token: string | null;
  refresh_token: string | null;
}

/** Build the document to insert for a new user (caller hashes the password). */
export function userCreateDoc(input: {
  firstName: string;
  lastName: string;
  email: string;
  loginType: LoginType;
  passwordHash: string;
  accountStatus?: AccountStatus;
  permissionList?: PermissionList | null;
}): UserDoc {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    loginType: input.loginType,
    password: input.passwordHash,
    accountStatus: input.accountStatus ?? AccountStatus.ACTIVE,
    permissionList: input.permissionList ?? null,
    date_created: nowSeconds(),
    last_updated: nowSeconds(),
  };
}

export function userOut(doc: Record<string, any>): UserOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    firstName: doc.firstName,
    lastName: doc.lastName,
    loginType: doc.loginType,
    email: doc.email,
    password: doc.password ?? null,
    accountStatus: doc.accountStatus ?? AccountStatus.ACTIVE,
    permissionList: doc.permissionList ?? null,
    date_created: doc.date_created ?? null,
    last_updated: doc.last_updated ?? null,
    access_token: doc.access_token ?? null,
    refresh_token: doc.refresh_token ?? null,
  };
}

/** Strip secrets before returning a user to a client. */
export function publicUser(user: UserOut): UserOut {
  return { ...user, password: null };
}
