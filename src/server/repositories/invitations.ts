import { type Filter, type Document } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { invitationOut, type InvitationDoc, type InvitationOut } from "@server/schemas/invitations";

/**
 * Invitation persistence, mirrors `repositories/invitation_repo.py`.
 */

export async function createInvitationRecord(doc: InvitationDoc): Promise<InvitationOut> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.invitations).insertOne({ ...doc });
  const stored = await db.collection(COLLECTIONS.invitations).findOne({ _id: res.insertedId });
  return invitationOut(stored!);
}

export async function getInvitation(filter: Filter<Document>): Promise<InvitationOut | null> {
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.invitations).findOne(filter);
  return result ? invitationOut(result) : null;
}

export async function getInvitations(
  filter: Filter<Document> = {},
  start = 0,
  stop = 100,
): Promise<InvitationOut[]> {
  const db = await getDb();
  const cursor = db
    .collection(COLLECTIONS.invitations)
    .find(filter)
    .sort({ date_created: -1 })
    .skip(start)
    .limit(stop - start);
  const items: InvitationOut[] = [];
  for await (const doc of cursor) items.push(invitationOut(doc));
  return items;
}

export async function updateInvitation(
  filter: Filter<Document>,
  data: Record<string, unknown>,
): Promise<InvitationOut | null> {
  const db = await getDb();
  const result = await db
    .collection(COLLECTIONS.invitations)
    .findOneAndUpdate(filter, { $set: { ...data } }, { returnDocument: "after" });
  return result ? invitationOut(result) : null;
}

export async function getInvitationByTokenHash(tokenHash: string): Promise<InvitationOut | null> {
  return getInvitation({ token_hash: tokenHash });
}
