import { AppError, ErrorCode, resourceNotFound } from "@server/core/errors";
import { PaymentManager } from "@server/core/payments/manager";
import {
  createPaymentTransaction,
  getPaymentTransactionByReference,
  getPaymentTransactionById,
  updatePaymentTransactionStatus,
  isWebhookEventProcessed,
  markWebhookEventProcessed,
} from "@server/repositories/payments";
import {
  paymentTransactionCreateDoc,
  webhookReplayCreateDoc,
  type PaymentIntentInput,
  type PaymentTransactionOut,
} from "@server/schemas/payments";

/**
 * Payment business logic, mirrors `services/payment_service.py`. Framework
 * agnostic: no next/* imports. The provider abstraction runs in stub mode when
 * keys are absent so this all works without any payment configuration.
 */

function paymentManager(): PaymentManager {
  return PaymentManager.getInstance();
}

export async function createPaymentIntent(
  ownerId: string,
  payload: PaymentIntentInput,
): Promise<PaymentTransactionOut> {
  const providerName = (payload.provider || "").toLowerCase() || null;
  const provider = paymentManager().getProvider(providerName);

  // Idempotency: an existing transaction for this reference is returned as-is.
  const existing = await getPaymentTransactionByReference(payload.reference);
  if (existing) return existing;

  const intent = await provider.createPaymentIntent({
    amount_minor: payload.amount_minor,
    currency: payload.currency,
    reference: payload.reference,
    customer_email: payload.customer_email ?? null,
    metadata: payload.metadata ?? null,
  });

  return createPaymentTransaction(
    paymentTransactionCreateDoc({
      owner_id: ownerId,
      provider: intent.provider,
      reference: intent.reference,
      status: intent.status,
      amount_minor: payload.amount_minor,
      currency: payload.currency,
      response_payload: intent.provider_payload,
      idempotency_key: `${intent.provider}:${intent.reference}`,
    }),
  );
}

export async function processWebhook(
  providerName: string,
  body: string,
  headers: Record<string, string>,
): Promise<{ processed: boolean; reference: string; status: string }> {
  const provider = paymentManager().getProvider(providerName);
  const event = await provider.verifyAndParseWebhook(body, headers);

  if (await isWebhookEventProcessed(providerName, event.event_id)) {
    throw new AppError({
      status: 409,
      code: ErrorCode.PAYMENT_WEBHOOK_INVALID,
      message: "Webhook already processed",
      details: { event_id: event.event_id },
    });
  }

  const data = (event.payload.data ?? {}) as Record<string, unknown>;
  const reference =
    (data.tx_ref as string | undefined) ??
    (data.reference as string | undefined) ??
    (event.payload.reference as string | undefined);
  if (!reference) {
    throw new AppError({
      status: 400,
      code: ErrorCode.PAYMENT_WEBHOOK_INVALID,
      message: "Webhook missing reference",
      details: event.payload,
    });
  }

  const tx = await provider.getStatus(reference);
  const updated = await updatePaymentTransactionStatus(reference, tx.status, tx.raw);
  if (updated === null) throw resourceNotFound("PaymentTransaction", reference);

  await markWebhookEventProcessed(webhookReplayCreateDoc(providerName, event.event_id));
  return { processed: true, reference, status: tx.status };
}

export async function getPaymentTransaction(paymentId: string): Promise<PaymentTransactionOut> {
  const tx = await getPaymentTransactionById(paymentId);
  if (tx === null) throw resourceNotFound("PaymentTransaction", paymentId);
  return tx;
}

export async function refundPayment(
  paymentId: string,
  amountMinor?: number | null,
): Promise<PaymentTransactionOut> {
  const tx = await getPaymentTransactionById(paymentId);
  if (tx === null) throw resourceNotFound("PaymentTransaction", paymentId);

  const provider = paymentManager().getProvider(tx.provider);
  const refunded = await provider.refund(tx.reference, amountMinor ?? null);
  const updated = await updatePaymentTransactionStatus(
    tx.reference,
    refunded.status,
    refunded.raw,
  );
  if (updated === null) throw resourceNotFound("PaymentTransaction", paymentId);
  return updated;
}
