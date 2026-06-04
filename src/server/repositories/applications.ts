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

export async function countByWeek(
  weeks = 5,
): Promise<{ week_start: number; week_end: number; applications: number; hires: number }[]> {
  const db = await getDb();
  const now = nowSeconds();
  const weekSeconds = 7 * 24 * 3600;
  const buckets: { week_start: number; week_end: number; applications: number; hires: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = now - (i + 1) * weekSeconds;
    const end = now - i * weekSeconds;
    const applications = await db
      .collection(COLLECTIONS.applications)
      .countDocuments({ date_created: { $gte: start, $lt: end } });
    const hires = await db
      .collection(COLLECTIONS.applications)
      .countDocuments({ status: "accepted", last_updated: { $gte: start, $lt: end } });
    buckets.push({ week_start: start, week_end: end, applications, hires });
  }
  return buckets;
}

export async function avgTimeToHireSeconds(): Promise<number> {
  const db = await getDb();
  const durations: number[] = [];
  const cursor = db.collection(COLLECTIONS.applicationStatusHistory).aggregate([
    { $match: { to_status: "accepted" } },
    { $group: { _id: "$application_id", accepted_at: { $max: "$changed_at" } } },
  ]);
  for await (const row of cursor) {
    const acceptedAt = row.accepted_at;
    const applicationId = row._id;
    if (acceptedAt == null || !applicationId) continue;
    const oid = toObjectId(String(applicationId));
    if (!oid) continue;
    const application = await db.collection(COLLECTIONS.applications).findOne({ _id: oid });
    if (!application) continue;
    const applied = application.applied_date ?? application.date_created;
    if (applied) durations.push(Number(acceptedAt) - Number(applied));
  }
  if (durations.length === 0) return 0;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
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
