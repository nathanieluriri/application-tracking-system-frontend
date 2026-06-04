import { type Filter, type Document } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { nowSeconds } from "@server/schemas/common";
import {
  emailTemplateOut,
  type EmailTemplateDoc,
  type EmailTemplateOut,
} from "@server/schemas/email-templates";

/**
 * Email-template persistence, mirrors `repositories/email_template_repo.py`.
 */

export async function createEmailTemplate(doc: EmailTemplateDoc): Promise<EmailTemplateOut> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.emailTemplates).insertOne({ ...doc });
  const stored = await db.collection(COLLECTIONS.emailTemplates).findOne({ _id: res.insertedId });
  return emailTemplateOut(stored!);
}

export async function getEmailTemplate(filter: Filter<Document>): Promise<EmailTemplateOut | null> {
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.emailTemplates).findOne(filter);
  return result ? emailTemplateOut(result) : null;
}

export async function getEmailTemplates(start = 0, stop = 100): Promise<EmailTemplateOut[]> {
  const db = await getDb();
  const cursor = db
    .collection(COLLECTIONS.emailTemplates)
    .find({ deleted_at: { $in: [null, undefined] } })
    .skip(start)
    .limit(stop - start);
  const items: EmailTemplateOut[] = [];
  for await (const doc of cursor) items.push(emailTemplateOut(doc));
  return items;
}

export async function updateEmailTemplate(
  filter: Filter<Document>,
  data: Record<string, unknown>,
): Promise<EmailTemplateOut | null> {
  const update: Record<string, unknown> = { last_updated: nowSeconds() };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) update[k] = v;
  }
  const db = await getDb();
  const result = await db
    .collection(COLLECTIONS.emailTemplates)
    .findOneAndUpdate(filter, { $set: update }, { returnDocument: "after" });
  return result ? emailTemplateOut(result) : null;
}

export async function deleteEmailTemplate(
  filter: Filter<Document>,
): Promise<{ deletedCount: number }> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.emailTemplates).deleteOne(filter);
  return { deletedCount: res.deletedCount };
}
