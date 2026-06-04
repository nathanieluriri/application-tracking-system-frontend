import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import {
  generateMemberAccessToken,
  generateAdminAccessToken,
  generateRefreshToken,
} from "@server/security/tokens";
import { decodeToken } from "@server/security/jwt";

describe("token generation", () => {
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

  it("mints a member access JWT carrying the user id and role", async () => {
    const uid = newId();
    const out = await generateMemberAccessToken(uid);
    expect(out.accesstoken!.split(".")).toHaveLength(3);
    const claims = await decodeToken(out.accesstoken!);
    expect(claims).toMatchObject({ userId: uid, role: "user" });
  });

  it("mints an admin access JWT with role admin", async () => {
    const uid = newId();
    const out = await generateAdminAccessToken(uid);
    const claims = await decodeToken(out.accesstoken!);
    expect(claims).toMatchObject({ userId: uid, role: "admin" });
  });

  it("creates a refresh record from an access JWT", async () => {
    const uid = newId();
    const access = await generateMemberAccessToken(uid);
    const refresh = await generateRefreshToken(uid, access.accesstoken!);
    expect(refresh.userId).toBe(uid);
    expect(typeof refresh.refreshtoken).toBe("string");
  });
});
