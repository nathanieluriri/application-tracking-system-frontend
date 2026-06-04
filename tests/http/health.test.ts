import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestDb, stopTestDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { GET } from "@/app/api/health/route";

const ctx = { params: Promise.resolve({}) };

describe("health route", () => {
  beforeAll(async () => {
    await startTestDb();
  });
  afterAll(async () => {
    await closeDb();
    await stopTestDb();
  });

  it("returns a healthy envelope with mongo status", async () => {
    const res = await GET(new Request("http://x/api/health"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("healthy");
    expect(body.data.services.mongo.status).toBe("healthy");
  });
});
