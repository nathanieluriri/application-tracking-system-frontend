import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { ensureDefaultProcess, resolveProcessForPosition } from "@server/services/application-process";
import { addPosition } from "@server/services/positions";

describe("application-process service", () => {
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

  it("creates the default 'Standard' system process once", async () => {
    const a = await ensureDefaultProcess();
    expect(a.name).toBe("Standard");
    expect(a.is_system).toBe(true);
    expect(a.stages[0].key).toBe("new");
    const b = await ensureDefaultProcess();
    expect(b.id).toBe(a.id); // idempotent
  });

  it("resolves the default process for a position with no template", async () => {
    const pos = await addPosition({ title: "Eng", status: "open" }, newId());
    const process = await resolveProcessForPosition(pos.id!);
    expect(process.name).toBe("Standard");
  });
});
