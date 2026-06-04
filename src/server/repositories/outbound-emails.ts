import { type Filter, type Document } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { nowSeconds } from "@server/schemas/common";
import {
  outboundEmailOut,
  type OutboundEmailDoc,
  type OutboundEmailOut,
} from "@server/schemas/outbound-emails";

/**
 * Outbound-email persistence, mirrors `repositories/outbound_email_repo.py`.
 */

export async function createOutboundRecords(
  docs: OutboundEmailDoc[],
): Promise<OutboundEmailOut[]> {
  if (docs.length === 0) return [];
  const db = await getDb();
  const res = await db
    .collection(COLLECTIONS.outboundEmails)
    .insertMany(docs.map((d) => ({ ...d })));
  const ids = Object.values(res.insertedIds);
  const cursor = db.collection(COLLECTIONS.outboundEmails).find({ _id: { $in: ids } });
  const items: OutboundEmailOut[] = [];
  for await (const doc of cursor) items.push(outboundEmailOut(doc));
  return items;
}

export async function updateOutboundStatusByResendId(
  resendEmailId: string,
  status: string,
  timestampField?: string | null,
): Promise<boolean> {
  const update: Record<string, unknown> = { status };
  if (timestampField) update[timestampField] = nowSeconds();
  const db = await getDb();
  const res = await db
    .collection(COLLECTIONS.outboundEmails)
    .updateOne({ resend_email_id: resendEmailId }, { $set: update });
  return res.modifiedCount > 0;
}

export async function updateOutboundRecord(
  filter: Filter<Document>,
  fields: Record<string, unknown>,
): Promise<boolean> {
  const db = await getDb();
  const res = await db
    .collection(COLLECTIONS.outboundEmails)
    .updateOne(filter, { $set: fields });
  return res.modifiedCount > 0;
}

export async function getOutboundEmails(
  filter: Filter<Document> = {},
  start = 0,
  stop = 100,
): Promise<OutboundEmailOut[]> {
  const db = await getDb();
  const cursor = db
    .collection(COLLECTIONS.outboundEmails)
    .find(filter)
    .sort({ date_created: -1 })
    .skip(start)
    .limit(stop - start);
  const items: OutboundEmailOut[] = [];
  for await (const doc of cursor) items.push(outboundEmailOut(doc));
  return items;
}

export async function getOutboundRecord(
  filter: Filter<Document>,
): Promise<OutboundEmailOut | null> {
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.outboundEmails).findOne(filter);
  return result ? outboundEmailOut(result) : null;
}

export async function countTotalSent(): Promise<number> {
  const db = await getDb();
  return db
    .collection(COLLECTIONS.outboundEmails)
    .countDocuments({ status: { $in: ["sent", "delivered"] } });
}

export async function countThisWeek(): Promise<number> {
  const cutoff = nowSeconds() - 7 * 24 * 3600;
  const db = await getDb();
  return db
    .collection(COLLECTIONS.outboundEmails)
    .countDocuments({ date_created: { $gte: cutoff }, status: { $in: ["sent", "delivered"] } });
}

export async function deliveryRate(): Promise<number> {
  const db = await getDb();
  const total = await db
    .collection(COLLECTIONS.outboundEmails)
    .countDocuments({ status: { $ne: "pending" } });
  if (total === 0) return 0;
  const delivered = await db
    .collection(COLLECTIONS.outboundEmails)
    .countDocuments({ status: "delivered" });
  return Math.round((delivered / total) * 100 * 100) / 100;
}
