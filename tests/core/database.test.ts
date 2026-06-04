import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestDb, stopTestDb } from "../helpers/db";
import { getDb, getClient, closeDb, COLLECTIONS } from "@server/core/database";

describe("database", () => {
  beforeAll(async () => {
    await startTestDb();
  });
  afterAll(async () => {
    await closeDb();
    await stopTestDb();
  });

  it("connects and round-trips a document", async () => {
    const db = await getDb();
    await db.collection("ping").insertOne({ ok: 1 });
    expect(await db.collection("ping").countDocuments()).toBe(1);
  });

  it("reuses the same underlying client (connects once)", async () => {
    const a = await getClient();
    const b = await getClient();
    expect(a).toBe(b);
  });

  it("exposes canonical collection names", () => {
    expect(COLLECTIONS.applications).toBe("applications");
    expect(COLLECTIONS.accessToken).toBe("accessToken");
    expect(COLLECTIONS.refreshToken).toBe("refreshToken");
  });
});
