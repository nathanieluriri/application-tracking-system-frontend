import { type Filter, type Document } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { adminOut, type AdminDoc, type AdminOut } from "@server/schemas/admins";
import { AccountStatus, nowSeconds } from "@server/schemas/common";
import { hashPassword } from "@server/security/hash";
import { defaultAdminPermissions } from "@server/security/permission-registry";

/**
 * Admin persistence, mirrors `repositories/admin_repo.py`, including the
 * bootstrap "super admin" fallback. The super admin is granted a wildcard
 * permission so it can operate the dashboard out of the box.
 */

export const SUPER_ADMIN_ID = "656f7ac12b9d4f6c9e2b9f7d";

let superAdminHashCache: string | null = null;

async function superAdminHash(): Promise<string> {
  if (superAdminHashCache === null) {
    superAdminHashCache = await hashPassword(process.env.SUPER_ADMIN_PASSWORD || "change-me-super-admin");
  }
  return superAdminHashCache;
}

async function buildSuperAdmin(): Promise<AdminOut | null> {
  const email = process.env.SUPER_ADMIN_EMAIL;
  if (!email) return null;
  return adminOut({
    _id: SUPER_ADMIN_ID,
    full_name: "Super Admin",
    email,
    password: await superAdminHash(),
    accountStatus: AccountStatus.ACTIVE,
    permissionList: defaultAdminPermissions(),
  });
}

export async function createAdmin(doc: AdminDoc): Promise<AdminOut> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.admins).insertOne({ ...doc });
  const stored = await db.collection(COLLECTIONS.admins).findOne({ _id: res.insertedId });
  return adminOut(stored!);
}

export async function getAdmin(filter: Filter<Document>): Promise<AdminOut | null> {
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.admins).findOne(filter);
  if (result) return adminOut(result);

  // Bootstrap fallback: resolve the env-configured super admin by email or id.
  const f = filter as Record<string, unknown>;
  const byEmail = f.email && f.email === process.env.SUPER_ADMIN_EMAIL;
  const byId = f._id && String(f._id) === SUPER_ADMIN_ID;
  if (byEmail || byId) return buildSuperAdmin();
  return null;
}

export async function getAdmins(start = 0, stop = 100): Promise<AdminOut[]> {
  const db = await getDb();
  const cursor = db
    .collection(COLLECTIONS.admins)
    .find({})
    .skip(start)
    .limit(stop - start);
  const items: AdminOut[] = [];
  for await (const doc of cursor) {
    const a = adminOut(doc);
    a.password = null;
    items.push(a);
  }
  const superAdmin = await buildSuperAdmin();
  if (superAdmin) {
    superAdmin.password = null;
    items.push(superAdmin);
  }
  return items;
}

export async function updateAdmin(
  filter: Filter<Document>,
  data: Record<string, unknown>,
): Promise<AdminOut | null> {
  const db = await getDb();
  const result = await db
    .collection(COLLECTIONS.admins)
    .findOneAndUpdate(
      filter,
      { $set: { ...data, last_updated: nowSeconds() } },
      { returnDocument: "after" },
    );
  return result ? adminOut(result) : null;
}

export async function deleteAdmin(filter: Filter<Document>): Promise<{ deletedCount: number }> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.admins).deleteOne(filter);
  return { deletedCount: res.deletedCount };
}
