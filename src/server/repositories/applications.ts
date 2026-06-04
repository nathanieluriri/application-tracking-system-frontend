import { type Filter, type Document, ObjectId } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { nowSeconds, toObjectId } from "@server/schemas/common";
import {
  applicationOut,
  type ApplicationCreate,
  type ApplicationOut,
  type StatusHistoryEntry,
} from "@server/schemas/applications";

/**
 * Application persistence, mirrors `repositories/application_repo.py`.
 */

export async function createApplication(doc: ApplicationCreate): Promise<ApplicationOut> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.applications).insertOne({ ...doc });
  const stored = await db.collection(COLLECTIONS.applications).findOne({ _id: res.insertedId });
  return applicationOut(stored!);
}

export async function getApplication(filter: Filter<Document>): Promise<ApplicationOut | null> {
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.applications).findOne(filter);
  return result ? applicationOut(result) : null;
}

export async function getApplications(
  filter: Filter<Document> = {},
  start = 0,
  stop = 100,
): Promise<ApplicationOut[]> {
  const db = await getDb();
  const cursor = db
    .collection(COLLECTIONS.applications)
    .find(filter)
    .skip(start)
    .limit(stop - start)
    .sort("date_created", -1);
  const items: ApplicationOut[] = [];
  for await (const doc of cursor) items.push(applicationOut(doc));
  return items;
}

export async function updateApplication(
  filter: Filter<Document>,
  data: Record<string, unknown>,
): Promise<ApplicationOut | null> {
  const update: Record<string, unknown> = { last_updated: nowSeconds() };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) update[k] = v;
  }
  const db = await getDb();
  const result = await db
    .collection(COLLECTIONS.applications)
    .findOneAndUpdate(filter, { $set: update }, { returnDocument: "after" });
  return result ? applicationOut(result) : null;
}

export async function deleteApplication(
  filter: Filter<Document>,
): Promise<{ deletedCount: number }> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.applications).deleteOne(filter);
  return { deletedCount: res.deletedCount };
}

export async function bulkUpdateStatus(ids: string[], newStatus: string): Promise<number> {
  const objectIds = ids.map(toObjectId).filter((o): o is ObjectId => o !== null);
  if (objectIds.length === 0) return 0;
  const db = await getDb();
  const res = await db
    .collection(COLLECTIONS.applications)
    .updateMany(
      { _id: { $in: objectIds } },
      { $set: { status: newStatus, last_updated: nowSeconds() } },
    );
  return res.modifiedCount;
}

export async function appendStatusHistory(entry: StatusHistoryEntry): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTIONS.applicationStatusHistory).insertOne({ ...entry });
}

export async function existingRecentSubmission(
  email: string,
  positionId: string,
  withinSeconds = 86400,
): Promise<boolean> {
  const cutoff = nowSeconds() - withinSeconds;
  const db = await getDb();
  const found = await db
    .collection(COLLECTIONS.applications)
    .findOne({ email, position_id: positionId, date_created: { $gte: cutoff } });
  return found !== null;
}

export async function countByStatus(): Promise<Record<string, number>> {
  const db = await getDb();
  const counts: Record<string, number> = {};
  const cursor = db
    .collection(COLLECTIONS.applications)
    .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  for await (const row of cursor) counts[row._id] = row.count;
  return counts;
}

export async function countByPosition(): Promise<{ position_id: string; count: number }[]> {
  const db = await getDb();
  const rows: { position_id: string; count: number }[] = [];
  const cursor = db
    .collection(COLLECTIONS.applications)
    .aggregate([{ $group: { _id: "$position_id", count: { $sum: 1 } } }]);
  for await (const row of cursor) rows.push({ position_id: row._id, count: row.count });
  return rows;
}

export async function countNewThisWeek(): Promise<number> {
  const db = await getDb();
  const weekAgo = nowSeconds() - 7 * 24 * 3600;
  return db.collection(COLLECTIONS.applications).countDocuments({ date_created: { $gte: weekAgo } });
}

export async function getStatusHistory(applicationId: string): Promise<Record<string, unknown>[]> {
  const db = await getDb();
  const cursor = db
    .collection(COLLECTIONS.applicationStatusHistory)
    .find({ application_id: applicationId })
    .sort("changed_at", 1);
  const rows: Record<string, unknown>[] = [];
  for await (const row of cursor) rows.push({ ...row, _id: String(row._id) });
  return rows;
}
