import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb, COLLECTIONS } from "@server/core/database";
import {
  checkUserAccountStatusAndPermissions,
  checkAdminAccountStatusAndPermissions,
  checkAccountStatusAndPermissions,
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

  it("grants a back-office permission to a default self-signup user (wildcard)", async () => {
    // Default users now carry the same wildcard back-office grant as admins.
    const user = await addUser(signup);
    const result = await checkUserAccountStatusAndPermissions(
      reqWithCookie(user.access_token!),
      "GET:/applications",
    );
    expect(result.id).toBe(user.id);
  });

  it("still denies a permission when the user has an explicit narrow list", async () => {
    const user = await addUser(signup);
    // Override the default wildcard with a narrow list to prove per-user lists win.
    await db.collection(COLLECTIONS.users).updateOne(
      { _id: new ObjectId(user.id!) },
      {
        $set: {
          permissionList: {
            permissions: [
              { name: "me", methods: ["GET"], path: "/users/me", key: "GET:/users/me" },
            ],
          },
        },
      },
    );
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

  describe("checkAccountStatusAndPermissions (role-aware)", () => {
    it("accepts a user principal and enforces against the user account", async () => {
      const user = await addUser(signup);
      const result = await checkAccountStatusAndPermissions(
        reqWithCookie(user.access_token!),
        "POST:/positions",
      );
      expect(result.id).toBe(user.id);
    });

    it("accepts an admin principal and enforces against the admin account", async () => {
      const admin = await addAdmin({
        full_name: "Adm",
        email: "adm2@example.com",
        password: "pw123456",
        accountStatus: AccountStatus.ACTIVE,
        permissionList: null,
      });
      const result = await checkAccountStatusAndPermissions(
        reqWithCookie(admin.access_token!),
        "POST:/positions",
      );
      expect(result.id).toBe(admin.id);
    });

    it("rejects an unauthenticated request", async () => {
      await expect(
        checkAccountStatusAndPermissions(new Request("http://x"), "GET:/positions"),
      ).rejects.toBeTruthy();
    });
  });
});
