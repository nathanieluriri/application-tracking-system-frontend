import { type Filter, type Document } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { nowSeconds } from "@server/schemas/common";
import {
  applicationProcessOut,
  type ApplicationProcessDoc,
  type ApplicationProcessOut,
} from "@server/schemas/application-process";

/**
 * Application-process persistence, mirrors
 * `repositories/application_process_repo.py`.
 */

export async function createApplicationProcess(
  doc: ApplicationProcessDoc,
): Promise<ApplicationProcessOut> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.applicationProcesses).insertOne({ ...doc });
  const stored = await db
    .collection(COLLECTIONS.applicationProcesses)
    .findOne({ _id: res.insertedId });
  return applicationProcessOut(stored!);
}

export async function getApplicationProcess(
  filter: Filter<Document>,
): Promise<ApplicationProcessOut | null> {
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.applicationProcesses).findOne(filter);
  return result ? applicationProcessOut(result) : null;
}

export async function getApplicationProcesses(start = 0, stop = 100): Promise<ApplicationProcessOut[]> {
  const db = await getDb();
  const cursor = db
    .collection(COLLECTIONS.applicationProcesses)
    .find({})
    .skip(start)
    .limit(stop - start);
  const items: ApplicationProcessOut[] = [];
  for await (const doc of cursor) items.push(applicationProcessOut(doc));
  return items;
}

export async function updateApplicationProcess(
  filter: Filter<Document>,
  data: Record<string, unknown>,
): Promise<ApplicationProcessOut | null> {
  const update: Record<string, unknown> = { last_updated: nowSeconds() };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) update[k] = v;
  }
  const db = await getDb();
  const result = await db
    .collection(COLLECTIONS.applicationProcesses)
    .findOneAndUpdate(filter, { $set: update }, { returnDocument: "after" });
  return result ? applicationProcessOut(result) : null;
}

export async function deleteApplicationProcess(
  filter: Filter<Document>,
): Promise<{ deletedCount: number }> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.applicationProcesses).deleteOne(filter);
  return { deletedCount: res.deletedCount };
}

export async function getDefaultProcess(): Promise<ApplicationProcessOut | null> {
  return getApplicationProcess({ is_system: true, name: "Standard" });
}
