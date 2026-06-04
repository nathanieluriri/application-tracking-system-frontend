import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { hitRateLimit } from "@server/security/rate-limit";

describe("rate limiter", () => {
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

  it("allows up to the amount, then blocks within the window", async () => {
    const rule = { amount: 2, windowSeconds: 60 };
    const first = await hitRateLimit("k1", rule);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);

    expect((await hitRateLimit("k1", rule)).allowed).toBe(true);

    const third = await hitRateLimit("k1", rule);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
    expect(third.limit).toBe(2);
  });

  it("tracks distinct keys independently", async () => {
    const rule = { amount: 1, windowSeconds: 60 };
    expect((await hitRateLimit("a", rule)).allowed).toBe(true);
    expect((await hitRateLimit("b", rule)).allowed).toBe(true);
    expect((await hitRateLimit("a", rule)).allowed).toBe(false);
  });
});
