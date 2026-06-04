import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import {
  addPosition,
  retrievePositionById,
  retrievePositions,
  retrieveOpenPositions,
  updatePositionById,
  closePosition,
  removePosition,
} from "@server/services/positions";

const base = { title: "Engineer", department: "R&D", employment_type: "full_time" as const, status: "open" as const };

describe("position service", () => {
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

  it("creates and fetches a position", async () => {
    const created = await addPosition(base, newId());
    expect(created.id).toBeTruthy();
    const fetched = await retrievePositionById(created.id!);
    expect(fetched.title).toBe("Engineer");
  });

  it("400s on an invalid id and 404s when missing", async () => {
    await expect(retrievePositionById("not-an-id")).rejects.toMatchObject({ status: 400 });
    await expect(retrievePositionById(newId())).rejects.toMatchObject({ status: 404 });
  });

  it("filters open positions for the public list", async () => {
    await addPosition({ ...base, status: "open" }, newId());
    await addPosition({ ...base, title: "Closed role", status: "closed" }, newId());
    const open = await retrieveOpenPositions();
    expect(open).toHaveLength(1);
    expect(open[0].status).toBe("open");
  });

  it("partial-updates without nulling other fields", async () => {
    const created = await addPosition(base, newId());
    const updated = await updatePositionById(created.id!, { location: "Remote" });
    expect(updated.location).toBe("Remote");
    expect(updated.title).toBe("Engineer"); // untouched
  });

  it("closes a position and deletes it", async () => {
    const created = await addPosition(base, newId());
    const closed = await closePosition(created.id!);
    expect(closed.status).toBe("closed");
    expect((await removePosition(created.id!)).deleted).toBe(true);
    await expect(retrievePositionById(created.id!)).rejects.toMatchObject({ status: 404 });
  });

  it("lists with a status filter", async () => {
    await addPosition({ ...base, status: "draft" }, newId());
    await addPosition({ ...base, status: "open" }, newId());
    const drafts = await retrievePositions({ status: "draft" });
    expect(drafts).toHaveLength(1);
  });
});
