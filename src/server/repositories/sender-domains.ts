import { type Filter, type Document } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { nowSeconds, toObjectId } from "@server/schemas/common";
import {
  senderDomainOut,
  type SenderDomainDoc,
  type SenderDomainOut,
} from "@server/schemas/sender-domains";

/**
 * Sender-domain persistence, mirrors `repositories/sender_domain_repo.py`.
 */

export async function createSenderDomain(doc: SenderDomainDoc): Promise<SenderDomainOut> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.senderDomains).insertOne({ ...doc });
  const stored = await db.collection(COLLECTIONS.senderDomains).findOne({ _id: res.insertedId });
  return senderDomainOut(stored!);
}

export async function listSenderDomains(orgId: string): Promise<SenderDomainOut[]> {
  const db = await getDb();
  const cursor = db
    .collection(COLLECTIONS.senderDomains)
    .find({ org_id: orgId })
    .sort({ date_created: -1 });
  const items: SenderDomainOut[] = [];
  for await (const doc of cursor) items.push(senderDomainOut(doc));
  return items;
}

export async function getSenderDomain(
  orgId: string,
  recordId: string,
): Promise<SenderDomainOut | null> {
  const oid = toObjectId(recordId);
  if (!oid) return null;
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.senderDomains).findOne({ _id: oid, org_id: orgId });
  return doc ? senderDomainOut(doc) : null;
}

export async function getByResendId(resendDomainId: string): Promise<SenderDomainOut | null> {
  const db = await getDb();
  const doc = await db
    .collection(COLLECTIONS.senderDomains)
    .findOne({ resend_domain_id: resendDomainId });
  return doc ? senderDomainOut(doc) : null;
}

export async function findExistingDomain(
  orgId: string,
  domain: string,
): Promise<SenderDomainOut | null> {
  const db = await getDb();
  const doc = await db
    .collection(COLLECTIONS.senderDomains)
    .findOne({ org_id: orgId, domain });
  return doc ? senderDomainOut(doc) : null;
}

export async function getVerifiedDomainForOrg(orgId: string): Promise<SenderDomainOut | null> {
  const db = await getDb();
  const doc = await db
    .collection(COLLECTIONS.senderDomains)
    .findOne({ org_id: orgId, status: "verified" });
  return doc ? senderDomainOut(doc) : null;
}

export async function updateSenderDomain(
  filter: Filter<Document>,
  fields: Record<string, unknown>,
): Promise<boolean> {
  const update: Record<string, unknown> = { last_updated: nowSeconds() };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) update[k] = v;
  }
  const db = await getDb();
  const res = await db
    .collection(COLLECTIONS.senderDomains)
    .updateOne(filter, { $set: update });
  return res.modifiedCount > 0;
}

export async function deleteSenderDomain(orgId: string, recordId: string): Promise<boolean> {
  const oid = toObjectId(recordId);
  if (!oid) return false;
  const db = await getDb();
  const res = await db
    .collection(COLLECTIONS.senderDomains)
    .deleteOne({ _id: oid, org_id: orgId });
  return res.deletedCount > 0;
}
