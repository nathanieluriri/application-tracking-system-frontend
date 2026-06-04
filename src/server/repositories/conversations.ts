import { type Filter, type Document } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { toObjectId, nowSeconds, isValidObjectId } from "@server/schemas/common";
import {
  conversationOut,
  conversationSummaryOut,
  type ConversationDoc,
  type ConversationMessage,
  type ConversationOut,
  type ConversationSummaryOut,
} from "@server/schemas/conversation";

function ownerScoped(id: string, ownerId: string): Filter<Document> | null {
  if (!isValidObjectId(id)) return null;
  return { _id: toObjectId(id)!, owner_id: ownerId };
}

export async function insertConversation(doc: ConversationDoc): Promise<ConversationOut> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.conversations).insertOne({ ...doc });
  const stored = await db
    .collection(COLLECTIONS.conversations)
    .findOne({ _id: res.insertedId });
  return conversationOut(stored!);
}

export async function findConversation(
  id: string,
  ownerId: string,
): Promise<ConversationOut | null> {
  const filter = ownerScoped(id, ownerId);
  if (!filter) return null;
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.conversations).findOne(filter);
  return doc ? conversationOut(doc) : null;
}

export async function pushMessages(
  id: string,
  ownerId: string,
  messages: ConversationMessage[],
): Promise<ConversationOut | null> {
  const filter = ownerScoped(id, ownerId);
  if (!filter) return null;
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.conversations).findOneAndUpdate(
    filter,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { $push: { messages: { $each: messages } } as any, $set: { last_updated: nowSeconds() } },
    { returnDocument: "after" },
  );
  return result ? conversationOut(result) : null;
}

export async function listConversations(
  ownerId: string,
  start = 0,
  stop = 50,
): Promise<ConversationSummaryOut[]> {
  const db = await getDb();
  const cursor = db
    .collection(COLLECTIONS.conversations)
    .find({ owner_id: ownerId })
    .sort({ last_updated: -1 })
    .skip(start)
    .limit(stop - start);
  const items: ConversationSummaryOut[] = [];
  for await (const doc of cursor) items.push(conversationSummaryOut(doc));
  return items;
}

export async function renameConversation(
  id: string,
  ownerId: string,
  title: string,
): Promise<ConversationOut | null> {
  const filter = ownerScoped(id, ownerId);
  if (!filter) return null;
  const db = await getDb();
  const result = await db
    .collection(COLLECTIONS.conversations)
    .findOneAndUpdate(
      filter,
      { $set: { title, last_updated: nowSeconds() } },
      { returnDocument: "after" },
    );
  return result ? conversationOut(result) : null;
}

export async function setMessageFeedback(
  id: string,
  ownerId: string,
  messageId: string,
  feedback: "up" | "down" | null,
): Promise<ConversationOut | null> {
  const filter = ownerScoped(id, ownerId);
  if (!filter) return null;
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.conversations).findOneAndUpdate(
    { ...filter, "messages.id": messageId },
    { $set: { "messages.$.feedback": feedback, last_updated: nowSeconds() } },
    { returnDocument: "after" },
  );
  return result ? conversationOut(result) : null;
}

export async function deleteConversation(
  id: string,
  ownerId: string,
): Promise<{ deletedCount: number }> {
  const filter = ownerScoped(id, ownerId);
  if (!filter) return { deletedCount: 0 };
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.conversations).deleteOne(filter);
  return { deletedCount: res.deletedCount };
}
