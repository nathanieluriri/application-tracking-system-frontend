import { getDb, COLLECTIONS } from "@server/core/database";
import { toObjectId } from "@server/schemas/common";
import { documentOut, type DocumentDoc, type DocumentOut } from "@server/schemas/documents";

/**
 * Document persistence, mirrors `repositories/document_repo.py`.
 */

export async function createDocument(doc: DocumentDoc): Promise<DocumentOut> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.documents).insertOne({ ...doc });
  const stored = await db.collection(COLLECTIONS.documents).findOne({ _id: res.insertedId });
  return documentOut(stored!);
}

export async function getDocumentById(documentId: string): Promise<DocumentOut | null> {
  const oid = toObjectId(documentId);
  if (!oid) return null;
  const db = await getDb();
  const row = await db.collection(COLLECTIONS.documents).findOne({ _id: oid });
  return row ? documentOut(row) : null;
}

export async function getDocumentByKey(objectKey: string): Promise<DocumentOut | null> {
  const db = await getDb();
  const row = await db.collection(COLLECTIONS.documents).findOne({ object_key: objectKey });
  return row ? documentOut(row) : null;
}

export async function deleteDocument(documentId: string): Promise<boolean> {
  const oid = toObjectId(documentId);
  if (!oid) return false;
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.documents).deleteOne({ _id: oid });
  return res.deletedCount > 0;
}
