import { type Filter, type Document } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { positionOut, type PositionDoc, type PositionOut } from "@server/schemas/positions";
import { nowSeconds } from "@server/schemas/common";

/**
 * Position persistence, mirrors `repositories/position_repo.py`.
 */

export async function createPosition(doc: PositionDoc): Promise<PositionOut> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.positions).insertOne({ ...doc });
  const stored = await db.collection(COLLECTIONS.positions).findOne({ _id: res.insertedId });
  return positionOut(stored!);
}

export async function getPosition(filter: Filter<Document>): Promise<PositionOut | null> {
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.positions).findOne(filter);
  return result ? positionOut(result) : null;
}

export async function getPositions(
  filter: Filter<Document> = {},
  start = 0,
  stop = 100,
): Promise<PositionOut[]> {
  const db = await getDb();
  const cursor = db
    .collection(COLLECTIONS.positions)
    // Stable, deterministic order is required for correct skip/limit pagination.
    // Newest-first, with an `_id` tie-break so rows sharing a `date_created`
    // second never reorder between requests (otherwise pages overlap/drop rows
    // and the list intermittently looks empty). Mirrors the sort every other
    // list repository already applies.
    .find(filter)
    .sort({ date_created: -1, _id: -1 })
    .skip(start)
    .limit(stop - start);
  const items: PositionOut[] = [];
  for await (const doc of cursor) items.push(positionOut(doc));
  return items;
}

export async function updatePosition(
  filter: Filter<Document>,
  data: Record<string, unknown>,
): Promise<PositionOut | null> {
  // Drop undefined keys so a partial update doesn't null out fields.
  const update: Record<string, unknown> = { last_updated: nowSeconds() };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) update[k] = v;
  }
  const db = await getDb();
  const result = await db
    .collection(COLLECTIONS.positions)
    .findOneAndUpdate(filter, { $set: update }, { returnDocument: "after" });
  return result ? positionOut(result) : null;
}

export async function deletePosition(filter: Filter<Document>): Promise<{ deletedCount: number }> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.positions).deleteOne(filter);
  return { deletedCount: res.deletedCount };
}

export async function getPositionCountsByStatus(): Promise<Record<string, number>> {
  const db = await getDb();
  const counts: Record<string, number> = {};
  const cursor = db
    .collection(COLLECTIONS.positions)
    .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  for await (const row of cursor) counts[row._id] = row.count;
  return counts;
}
