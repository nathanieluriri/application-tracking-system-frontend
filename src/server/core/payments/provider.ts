/**
 * Payment provider abstraction + shared value objects, mirrors
 * `core/payments/provider.py` and `core/payments/types.py`.
 *
 * Providers are framework-agnostic; they never import next/* and they lazily
 * load heavy SDKs (e.g. `stripe`) so the app boots without keys. Each provider
 * supports a "stub mode" when its secret key is absent: intents return a
 * synthetic payload and webhooks are parsed without signature verification.
 */

export enum PaymentProviderName {
  STRIPE = "stripe",
  FLUTTERWAVE = "flutterwave",
}

export enum PaymentStatus {
  PENDING = "pending",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export interface PaymentIntentIn {
  amount_minor: number;
  currency: string;
  reference: string;
  customer_email?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PaymentIntentResponse {
  provider: PaymentProviderName;
  reference: string;
  status: PaymentStatus;
  checkout_url: string | null;
  provider_payload: Record<string, unknown>;
}

export interface WebhookEvent {
  provider: PaymentProviderName;
  event_id: string;
  event_type: string;
  payload: Record<string, any>;
}

export interface PaymentTransactionResult {
  provider: PaymentProviderName;
  reference: string;
  status: PaymentStatus;
  raw: Record<string, any>;
}

export interface PaymentProvider {
  readonly providerName: string;
  /** True when the provider has no secret key and is running in stub mode. */
  readonly isStub: boolean;
  createPaymentIntent(payload: PaymentIntentIn): Promise<PaymentIntentResponse>;
  verifyAndParseWebhook(body: string, headers: Record<string, string>): Promise<WebhookEvent>;
  getStatus(reference: string): Promise<PaymentTransactionResult>;
  refund(reference: string, amountMinor?: number | null): Promise<PaymentTransactionResult>;
}
