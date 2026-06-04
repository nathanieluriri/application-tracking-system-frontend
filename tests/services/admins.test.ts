import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { addAdmin, authenticateAdmin } from "@server/services/admins";
import { AccountStatus } from "@server/schemas/common";

const adminInput = {
  full_name: "Grace Hopper",
  email: "grace@example.com",
  password: "pw123456",
  accountStatus: AccountStatus.ACTIVE,
  permissionList: null,
};

describe("admin service", () => {
  let db: Db;
  beforeAll(async () => {
    db = await startTestDb();
  });
  afterEach(async () => {
    await clearDb(db);
  });
  afterAll(async () => {
    await closeDb();
    await stopTestDb();
  });

  it("creates an admin with default (wildcard) permissions and authenticates", async () => {
    const admin = await addAdmin(adminInput);
    expect(admin.permissionList?.permissions?.[0]?.key).toBe("*");
    expect(admin.password).toBeNull();
    const ok = await authenticateAdmin({ email: adminInput.email, password: adminInput.password });
    expect(ok.access_token).toBeTruthy();
  });

  it("rejects a duplicate admin email with 409", async () => {
    await addAdmin(adminInput);
    await expect(addAdmin(adminInput)).rejects.toMatchObject({ status: 409 });
  });

  it("logs in the env-configured super admin even without a DB record", async () => {
    process.env.SUPER_ADMIN_EMAIL = "root@ats.local";
    process.env.SUPER_ADMIN_PASSWORD = "rootpw123";
    const ok = await authenticateAdmin({ email: "root@ats.local", password: "rootpw123" });
    expect(ok.access_token).toBeTruthy();
    expect(ok.permissionList?.permissions?.[0]?.key).toBe("*");
  });
});
