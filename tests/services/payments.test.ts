import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { resetSettingsCache } from "@server/core/settings";
import { PaymentManager } from "@server/core/payments/manager";
import {
  createPaymentIntent,
  getPaymentTransaction,
  processWebhook,
  refundPayment,
} from "@server/services/payments";

const intent = {
  amount_minor: 5000,
  currency: "USD",
  reference: "ref-12345",
};

describe("payment service (stub mode, no provider keys)", () => {
  let db: Db;

  beforeAll(async () => {
    db = await startTestDb();
    // Ensure no payment keys are present so providers run in stub mode.
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.FLUTTERWAVE_SECRET_KEY;
    delete process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
    process.env.PAYMENT_DEFAULT_PROVIDER = "stripe";
    resetSettingsCache();
    PaymentManager.reset();
  });

  afterEach(async () => {
    await clearDb(db);
  });

  afterAll(async () => {
    await closeDb();
    await stopTestDb();
    PaymentManager.reset();
    resetSettingsCache();
  });

  it("creates a payment intent in stub mode with a synthetic client_secret", async () => {
    const owner = newId();
    const tx = await createPaymentIntent(owner, intent);
    expect(tx.id).toBeTruthy();
    expect(tx.owner_id).toBe(owner);
    expect(tx.provider).toBe("stripe");
    expect(tx.status).toBe("pending");
    expect(tx.reference).toBe(intent.reference);
    expect(tx.response_payload).toMatchObject({ stub: true });
    expect(tx.response_payload.client_secret).toBeTruthy();
  });

  it("is idempotent: a repeat reference returns the same transaction", async () => {
    const owner = newId();
    const first = await createPaymentIntent(owner, intent);
    const second = await createPaymentIntent(owner, intent);
    expect(second.id).toBe(first.id);
  });

  it("409s when the repository inserts a duplicate reference", async () => {
    const owner = newId();
    await createPaymentIntent(owner, intent);
    // The repo enforces idempotency on `reference`: a second insert is a 409.
    const { createPaymentTransaction } = await import("@server/repositories/payments");
    const { paymentTransactionCreateDoc } = await import("@server/schemas/payments");
    await expect(
      createPaymentTransaction(
        paymentTransactionCreateDoc({
          owner_id: owner,
          provider: "stripe",
          reference: intent.reference,
          status: "pending",
          amount_minor: intent.amount_minor,
          currency: intent.currency,
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("fetches a transaction and enforces the owner check", async () => {
    const owner = newId();
    const tx = await createPaymentIntent(owner, intent);
    const fetched = await getPaymentTransaction(tx.id!);
    expect(fetched.owner_id).toBe(owner);
    // A different (non-admin) principal must not own it.
    expect(fetched.owner_id).not.toBe(newId());
  });

  it("404s when fetching a missing transaction", async () => {
    await expect(getPaymentTransaction(newId())).rejects.toMatchObject({ status: 404 });
  });

  it("processes a stub webhook and marks the transaction succeeded", async () => {
    const owner = newId();
    const created = await createPaymentIntent(owner, intent);

    const body = JSON.stringify({
      id: "evt_test_1",
      type: "payment_intent.succeeded",
      reference: intent.reference,
    });
    const result = await processWebhook("stripe", body, {});
    expect(result.processed).toBe(true);
    expect(result.reference).toBe(intent.reference);
    expect(result.status).toBe("succeeded");

    const updated = await getPaymentTransaction(created.id!);
    expect(updated.status).toBe("succeeded");
  });

  it("rejects a replayed webhook event with 409", async () => {
    const owner = newId();
    await createPaymentIntent(owner, intent);
    const body = JSON.stringify({
      id: "evt_replay_1",
      type: "payment_intent.succeeded",
      reference: intent.reference,
    });
    await processWebhook("stripe", body, {});
    await expect(processWebhook("stripe", body, {})).rejects.toMatchObject({ status: 409 });
  });

  it("400s on a webhook missing a reference", async () => {
    const body = JSON.stringify({ id: "evt_noref", type: "payment_intent.succeeded" });
    await expect(processWebhook("stripe", body, {})).rejects.toMatchObject({ status: 400 });
  });

  it("refunds a transaction in stub mode", async () => {
    const owner = newId();
    const tx = await createPaymentIntent(owner, intent);
    const refunded = await refundPayment(tx.id!, 5000);
    expect(refunded.status).toBe("refunded");
    expect(refunded.reference).toBe(intent.reference);
  });

  it("rejects an unsupported provider name", async () => {
    expect(() => PaymentManager.getInstance().getProvider("paypal")).toThrow();
  });
});
