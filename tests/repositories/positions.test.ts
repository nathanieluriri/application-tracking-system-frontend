import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb, getDb, COLLECTIONS } from "@server/core/database";
import { getPositions } from "@server/repositories/positions";

/**
 * Pagination correctness for the positions list.
 *
 * The list page paginates with `.skip()/.limit()`. Mongo only guarantees a
 * stable order across queries when the cursor is explicitly sorted; an unsorted
 * `find()` returns documents in an unstable "natural" order, which makes
 * skip/limit pages overlap or drop rows after document churn — the cause of the
 * "positions page sometimes shows empty even though there's data" bug.
 *
 * These tests pin a deterministic newest-first order with an `_id` tie-break.
 */
describe("positions repository — list ordering & pagination", () => {
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

  async function insertPosition(title: string, dateCreated: number) {
    const conn = await getDb();
    await conn.collection(COLLECTIONS.positions).insertOne({
      title,
      status: "open",
      date_created: dateCreated,
      last_updated: dateCreated,
    });
  }

  it("returns positions newest-first by date_created", async () => {
    await insertPosition("oldest", 100);
    await insertPosition("middle", 200);
    await insertPosition("newest", 300);

    const all = await getPositions({}, 0, 100);
    expect(all.map((p) => p.title)).toEqual(["newest", "middle", "oldest"]);
  });

  it("breaks date_created ties deterministically (stable order across calls)", async () => {
    // Same timestamp on every row — without an _id tie-break the order is
    // undefined, so two identical queries could disagree.
    for (let i = 0; i < 10; i++) await insertPosition(`role-${i}`, 500);

    const first = (await getPositions({}, 0, 100)).map((p) => p.title);
    const second = (await getPositions({}, 0, 100)).map((p) => p.title);
    expect(first).toEqual(second);
  });

  it("paginates without dropping or duplicating rows", async () => {
    for (let i = 0; i < 10; i++) await insertPosition(`role-${i}`, 1000 + i);

    const pageSize = 4;
    const page1 = await getPositions({}, 0, pageSize);
    const page2 = await getPositions({}, pageSize, pageSize * 2);
    const page3 = await getPositions({}, pageSize * 2, pageSize * 3);

    const seen = [...page1, ...page2, ...page3].map((p) => p.title);
    expect(seen).toHaveLength(10);
    expect(new Set(seen).size).toBe(10); // no duplicates across pages

    // Pages are contiguous slices of the same newest-first ordering.
    const all = (await getPositions({}, 0, 100)).map((p) => p.title);
    expect(seen).toEqual(all);
  });
});
