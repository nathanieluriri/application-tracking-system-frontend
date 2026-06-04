import { getDb, COLLECTIONS } from "@server/core/database";
import { adminCreateDoc } from "@server/schemas/admins";
import { hashPassword } from "@server/security/hash";
import { defaultAdminPermissions } from "@server/security/permission-registry";

/**
 * Idempotently create a super admin with full (wildcard) dashboard permissions.
 * Run via `bun run seed`.
 */
export async function seedSuperAdmin(
  email: string,
  password: string,
): Promise<{ created: boolean; id: string | null }> {
  const db = await getDb();
  const existing = await db.collection(COLLECTIONS.admins).findOne({ email });
  if (existing) {
    return { created: false, id: existing._id.toString() };
  }
  const passwordHash = await hashPassword(password);
  const doc = adminCreateDoc({
    full_name: "Super Admin",
    email,
    passwordHash,
    permissionList: defaultAdminPermissions(),
  });
  const res = await db.collection(COLLECTIONS.admins).insertOne(doc);
  return { created: true, id: res.insertedId.toString() };
}
