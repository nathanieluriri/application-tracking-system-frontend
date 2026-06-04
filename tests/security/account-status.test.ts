import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb, COLLECTIONS } from "@server/core/database";
import {
  checkUserAccountStatusAndPermissions,
  checkAdminAccountStatusAndPermissions,
} from "@server/security/account-status";
import { addUser } from "@server/services/users";
import { addAdmin } from "@server/services/admins";
import { LoginType, AccountStatus } from "@server/schemas/common";

function reqWithCookie(token: string): Request {
  return new Request("http://x", { headers: { cookie: `access_token=${token}` } });
}

const signup = {
  firstName: "Ada",
  lastName: "L",
  email: "ada@example.com",
  password: "pw123456",
  loginType: LoginType.email,
};

describe("account-status guards", () => {
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

  it("passes for an active user holding the permission, and strips the password", async () => {
    const user = await addUser(signup);
    const result = await checkUserAccountStatusAndPermissions(
      reqWithCookie(user.access_token!),
      "GET:/users/me",
    );
    expect(result.id).toBe(user.id);
    expect(result.password).toBeNull();
  });

  it("denies a permission the user does not hold", async () => {
    const user = await addUser(signup);
    await expect(
      checkUserAccountStatusAndPermissions(reqWithCookie(user.access_token!), "GET:/applications"),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });

  it("rejects an inactive account", async () => {
    const user = await addUser(signup);
    await db
      .collection(COLLECTIONS.users)
      .updateOne({ _id: new ObjectId(user.id!) }, { $set: { accountStatus: "INACTIVE" } });
    await expect(
      checkUserAccountStatusAndPermissions(reqWithCookie(user.access_token!), "GET:/users/me"),
    ).rejects.toMatchObject({ code: "AUTH_ACCOUNT_INACTIVE" });
  });

  it("admin wildcard grants any permission key", async () => {
    const admin = await addAdmin({
      full_name: "Adm",
      email: "adm@example.com",
      password: "pw123456",
      accountStatus: AccountStatus.ACTIVE,
      permissionList: null,
    });
    const result = await checkAdminAccountStatusAndPermissions(
      reqWithCookie(admin.access_token!),
      "GET:/applications",
    );
    expect(result.id).toBe(admin.id);
  });
});
