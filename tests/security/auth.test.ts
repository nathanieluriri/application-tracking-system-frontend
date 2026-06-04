import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { resolvePrincipal, verifyAdmin } from "@server/security/auth";
import { generateMemberAccessToken, generateAdminAccessToken } from "@server/security/tokens";

describe("principal resolution", () => {
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

  it("resolves a user principal from a cookie token", async () => {
    const uid = newId();
    const out = await generateMemberAccessToken(uid);
    const p = await resolvePrincipal({ accessTokenCookie: out.accesstoken! }, { requireRole: "user" });
    expect(p.userId).toBe(uid);
    expect(p.role).toBe("user");
  });

  it("resolves from a Bearer header too", async () => {
    const uid = newId();
    const out = await generateAdminAccessToken(uid);
    const p = await verifyAdmin({ authorization: `Bearer ${out.accesstoken}` });
    expect(p.userId).toBe(uid);
    expect(p.isAdmin).toBe(true);
  });

  it("throws AUTH_INVALID_TOKEN when there is no token", async () => {
    await expect(resolvePrincipal({}, {})).rejects.toMatchObject({ code: "AUTH_INVALID_TOKEN" });
  });

  it("throws AUTH_ROLE_MISMATCH for the wrong role", async () => {
    const uid = newId();
    const out = await generateMemberAccessToken(uid);
    await expect(
      resolvePrincipal({ accessTokenCookie: out.accesstoken! }, { requireRole: "admin" }),
    ).rejects.toMatchObject({ code: "AUTH_ROLE_MISMATCH" });
  });
});
