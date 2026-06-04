import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { requireUser, requireAdmin, optionalAuth } from "@server/http/guards";
import { generateMemberAccessToken } from "@server/security/tokens";

function reqWithCookie(token: string): Request {
  return new Request("http://x", { headers: { cookie: `access_token=${token}` } });
}

describe("http guards", () => {
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

  it("requireUser returns the principal for a valid user cookie", async () => {
    const uid = newId();
    const out = await generateMemberAccessToken(uid);
    const p = await requireUser(reqWithCookie(out.accesstoken!));
    expect(p.userId).toBe(uid);
  });

  it("requireAdmin rejects a user token", async () => {
    const uid = newId();
    const out = await generateMemberAccessToken(uid);
    await expect(requireAdmin(reqWithCookie(out.accesstoken!))).rejects.toMatchObject({
      code: "AUTH_ROLE_MISMATCH",
    });
  });

  it("optionalAuth returns null when unauthenticated", async () => {
    expect(await optionalAuth(new Request("http://x"))).toBeNull();
  });
});
