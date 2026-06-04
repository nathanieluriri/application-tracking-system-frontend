import { z } from "zod";
// Import ObjectId from `bson` (browser-safe) rather than `mongodb`: this module
// also exports enums/zod schemas used by client code, and importing `mongodb`
// here would drag its Node-only deps ('net'/'crypto'/…) into the client bundle.
// mongodb's ObjectId IS bson's ObjectId, so the driver accepts these instances.
import { ObjectId } from "bson";

/**
 * Shared enums + value objects, mirrors `schemas/imports.py`.
 */

export enum LoginType {
  google = "GOOGLE",
  email = "EMAIL",
}

export enum AccountStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
}

export const permissionSchema = z.object({
  name: z.string(),
  methods: z.array(z.string()),
  path: z.string(),
  key: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});
export type Permission = z.infer<typeof permissionSchema>;

export const permissionListSchema = z.object({
  permissions: z.array(permissionSchema),
});
export type PermissionList = z.infer<typeof permissionListSchema>;

/** Coerce a Mongo `_id` (ObjectId | string) to a string, in place. */
export function stringifyId<T extends Record<string, any>>(doc: T): T & { _id?: string } {
  if (doc && doc._id instanceof ObjectId) {
    return { ...doc, _id: doc._id.toString() };
  }
  return doc;
}

/** Parse a string to ObjectId or return null (never throws). */
export function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export function isValidObjectId(id: string): boolean {
  return toObjectId(id) !== null;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
