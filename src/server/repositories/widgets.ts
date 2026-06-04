import { type Filter, type Document } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { widgetOut, type WidgetDoc, type WidgetOut } from "@server/schemas/widgets";

/**
 * Widget persistence, mirrors the positions repository.
 */

export async function createWidget(doc: WidgetDoc): Promise<WidgetOut> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.widgets).insertOne({ ...doc });
  const stored = await db.collection(COLLECTIONS.widgets).findOne({ _id: res.insertedId });
  return widgetOut(stored!);
}

export async function getWidget(filter: Filter<Document>): Promise<WidgetOut | null> {
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.widgets).findOne(filter);
  return result ? widgetOut(result) : null;
}

export async function getWidgets(start = 0, stop = 100): Promise<WidgetOut[]> {
  const db = await getDb();
  const cursor = db.collection(COLLECTIONS.widgets).find({}).skip(start).limit(stop - start);
  const items: WidgetOut[] = [];
  for await (const doc of cursor) items.push(widgetOut(doc));
  return items;
}

export async function updateWidget(
  filter: Filter<Document>,
  set: Record<string, unknown>,
): Promise<WidgetOut | null> {
  const db = await getDb();
  const result = await db
    .collection(COLLECTIONS.widgets)
    .findOneAndUpdate(filter, { $set: set }, { returnDocument: "after" });
  return result ? widgetOut(result) : null;
}

export async function deleteWidget(filter: Filter<Document>): Promise<{ deletedCount: number }> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.widgets).deleteOne(filter);
  return { deletedCount: res.deletedCount };
}
