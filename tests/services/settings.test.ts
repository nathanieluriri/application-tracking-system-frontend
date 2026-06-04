import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { cacheClear } from "@server/core/cache";
import { retrieveSettings, saveSettings } from "@server/services/settings";

describe("settings service", () => {
  let db: Db;
  beforeAll(async () => {
    db = await startTestDb();
  });
  afterEach(async () => {
    await clearDb(db);
    cacheClear();
  });
  afterAll(async () => {
    await closeDb();
    await stopTestDb();
  });

  it("returns defaults when nothing is saved", async () => {
    const s = await retrieveSettings();
    expect(s.portal.accept_applications).toBe(true);
    expect(s.email.sender_name).toBe("HR Team");
  });

  it("upserts a partial update and merges with existing values", async () => {
    await saveSettings({ portal: { require_cv: false } });
    const s = await retrieveSettings();
    expect(s.portal.require_cv).toBe(false);
    expect(s.portal.accept_applications).toBe(true); // preserved
  });

  it("invalidates the cache on save", async () => {
    await retrieveSettings(); // warm cache with defaults
    await saveSettings({ email: { sender_name: "Talent" } });
    const s = await retrieveSettings();
    expect(s.email.sender_name).toBe("Talent");
  });
});
