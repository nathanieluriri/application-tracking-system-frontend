import { type Filter, type Document } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { conflict } from "@server/core/errors";
import { isValidObjectId, toObjectId, nowSeconds } from "@server/schemas/common";
import {
  paymentTransactionOut,
  type PaymentTransactionDoc,
  type PaymentTransactionOut,
  type WebhookReplayDoc,
} from "@server/schemas/payments";

/**
 * Payment persistence, mirrors `repositories/payment_repo.py`. Idempotency is
 * enforced on `reference`: a duplicate insert raises a 409 conflict.
 */

const WEBHOOK_EVENTS_COLLECTION = "payment_webhook_events";

export async function createPaymentTransaction(
  doc: PaymentTransactionDoc,
): Promise<PaymentTransactionOut> {
  const db = await getDb();
  const collection = db.collection(COLLECTIONS.payments);

  const existing = await collection.findOne({ reference: doc.reference });
  if (existing) {
    throw conflict("A payment transaction with this reference already exists", {
      reference: doc.reference,
    });
  }

  const res = await collection.insertOne({ ...doc });
  const stored = await collection.findOne({ _id: res.insertedId });
  return paymentTransactionOut(stored!);
}

export async function getPaymentTransactionByReference(
  reference: string,
): Promise<PaymentTransactionOut | null> {
  const db = await getDb();
  const row = await db.collection(COLLECTIONS.payments).findOne({ reference });
  return row ? paymentTransactionOut(row) : null;
}

export async function getPaymentTransactionById(
  paymentId: string,
): Promise<PaymentTransactionOut | null> {
  if (!isValidObjectId(paymentId)) return null;
  const db = await getDb();
  const row = await db.collection(COLLECTIONS.payments).findOne({ _id: toObjectId(paymentId)! });
  return row ? paymentTransactionOut(row) : null;
}

export async function getPaymentTransaction(
  filter: Filter<Document>,
): Promise<PaymentTransactionOut | null> {
  const db = await getDb();
  const row = await db.collection(COLLECTIONS.payments).findOne(filter);
  return row ? paymentTransactionOut(row) : null;
}

export async function updatePaymentTransactionStatus(
  reference: string,
  status: string,
  responsePayload: Record<string, unknown>,
): Promise<PaymentTransactionOut | null> {
  const db = await getDb();
  const row = await db.collection(COLLECTIONS.payments).findOneAndUpdate(
    { reference },
    { $set: { status, response_payload: responsePayload, updated_at: nowSeconds() } },
    { returnDocument: "after" },
  );
  return row ? paymentTransactionOut(row) : null;
}

export async function isWebhookEventProcessed(
  provider: string,
  eventId: string,
): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .collection(WEBHOOK_EVENTS_COLLECTION)
    .findOne({ provider, event_id: eventId });
  return row !== null;
}

export async function markWebhookEventProcessed(doc: WebhookReplayDoc): Promise<void> {
  const db = await getDb();
  await db.collection(WEBHOOK_EVENTS_COLLECTION).insertOne({ ...doc });
}
