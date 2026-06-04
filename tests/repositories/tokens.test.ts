import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { getDb, closeDb, COLLECTIONS } from "@server/core/database";
import {
  addAccessToken,
  addAdminAccessToken,
  addRefreshToken,
  getAccessToken,
  getAccessTokenAllowExpired,
  getRefreshToken,
  deleteAllTokensForUser,
} from "@server/repositories/tokens";
import { signRoleToken } from "@server/security/jwt";

describe("token repository", () => {
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

  it("creates a member access record resolvable from its JWT", async () => {
    const uid = newId();
    const rec = await addAccessToken(uid);
    expect(rec.role).toBe("member");
    const jwt = await signRoleToken({ accessToken: rec.accesstoken!, userId: uid, role: "user" });
    const resolved = await getAccessToken(jwt);
    expect(resolved?.userId).toBe(uid);
  });

  it("rejects a record older than the TTL unless allow-expired", async () => {
    const uid = newId();
    const rec = await addAccessToken(uid);
    await db
      .collection(COLLECTIONS.accessToken)
      .updateOne({ _id: new ObjectId(rec.accesstoken!) }, { $set: { dateCreated: 0 } });
    const jwt = await signRoleToken({ accessToken: rec.accesstoken!, userId: uid, role: "user" });
    // allow-expired must read the stale record without deleting it...
    expect(await getAccessTokenAllowExpired(jwt)).not.toBeNull();
    // ...and the strict path then evicts it and returns null.
    expect(await getAccessToken(jwt)).toBeNull();
    expect(await getAccessTokenAllowExpired(jwt)).toBeNull();
  });

  it("returns null for an admin token that is not active", async () => {
    const uid = newId();
    const rec = await addAdminAccessToken(uid);
    const jwt = await signRoleToken({ accessToken: rec.accesstoken!, userId: uid, role: "admin" });
    expect(await getAccessToken(jwt)).not.toBeNull();
    await db
      .collection(COLLECTIONS.accessToken)
      .updateOne({ _id: new ObjectId(rec.accesstoken!) }, { $set: { status: "inactive" } });
    expect(await getAccessToken(jwt)).toBeNull();
  });

  it("creates and fetches a refresh record, and deletes all tokens for a user", async () => {
    const uid = newId();
    const access = await addAccessToken(uid);
    const refresh = await addRefreshToken(uid, access.accesstoken!);
    expect((await getRefreshToken(refresh.refreshtoken!))?.userId).toBe(uid);

    await deleteAllTokensForUser(uid);
    expect(await db.collection(COLLECTIONS.accessToken).countDocuments({ userId: uid })).toBe(0);
    expect(await db.collection(COLLECTIONS.refreshToken).countDocuments({ userId: uid })).toBe(0);
  });
});
