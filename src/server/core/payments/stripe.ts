import { AppError, ErrorCode } from "@server/core/errors";
import {
  PaymentProviderName,
  PaymentStatus,
  type PaymentIntentIn,
  type PaymentIntentResponse,
  type PaymentProvider,
  type PaymentTransactionResult,
  type WebhookEvent,
} from "./provider";

/**
 * Stripe payment provider, mirrors `core/payments/stripe_provider.py`.
 *
 * The `stripe` SDK is imported lazily so the app boots without it. When
 * `STRIPE_SECRET_KEY` is absent the provider runs in *stub mode*: intents return
 * a synthetic `client_secret`/`id` and webhooks are parsed without signature
 * verification. This keeps local/test environments working with no Stripe keys.
 */

// Loaded lazily; `any` because the SDK is an optional dependency.
type StripeLike = any;

export class StripePaymentProvider implements PaymentProvider {
  readonly providerName = PaymentProviderName.STRIPE;

  private readonly secretKey: string | null;
  private readonly webhookSecret: string | null;
  private stripe: StripeLike | null = null;

  constructor(opts: { secretKey?: string | null; webhookSecret?: string | null } = {}) {
    this.secretKey = opts.secretKey ?? null;
    this.webhookSecret = opts.webhookSecret ?? null;
  }

  get isStub(): boolean {
    return !this.secretKey;
  }

  /** Lazily import and configure the Stripe SDK (only when a key is present). */
  private async client(): Promise<StripeLike> {
    if (this.stripe) return this.stripe;
    let StripeCtor: any;
    try {
      const mod = await import("stripe");
      StripeCtor = (mod as any).default ?? mod;
    } catch (err) {
      throw new AppError({
        status: 502,
        code: ErrorCode.PAYMENT_PROVIDER_ERROR,
        message: "stripe package is required for the Stripe payment provider",
        details: String(err),
      });
    }
    this.stripe = new StripeCtor(this.secretKey as string);
    return this.stripe;
  }

  async createPaymentIntent(payload: PaymentIntentIn): Promise<PaymentIntentResponse> {
    if (this.isStub) {
      const id = `pi_stub_${payload.reference}`;
      return {
        provider: PaymentProviderName.STRIPE,
        reference: payload.reference,
        status: PaymentStatus.PENDING,
        checkout_url: null,
        provider_payload: {
          client_secret: `${id}_secret_stub`,
          id,
          stub: true,
        },
      };
    }

    try {
      const stripe = await this.client();
      const intent = await stripe.paymentIntents.create({
        amount: payload.amount_minor,
        currency: payload.currency.toLowerCase(),
        metadata: { reference: payload.reference, ...(payload.metadata ?? {}) },
        receipt_email: payload.customer_email ?? undefined,
        automatic_payment_methods: { enabled: true },
      });
      return {
        provider: PaymentProviderName.STRIPE,
        reference: payload.reference,
        status: PaymentStatus.PENDING,
        checkout_url: null,
        provider_payload: { client_secret: intent.client_secret, id: intent.id },
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError({
        status: 502,
        code: ErrorCode.PAYMENT_PROVIDER_ERROR,
        message: "Stripe intent creation failed",
        details: String(err),
      });
    }
  }

  async verifyAndParseWebhook(
    body: string,
    headers: Record<string, string>,
  ): Promise<WebhookEvent> {
    const signature = headers["stripe-signature"] ?? headers["Stripe-Signature"];

    // Stub mode (no secret key — local/dev): trust the payload, no verification.
    if (this.isStub) {
      const parsed = this.safeParse(body);
      return {
        provider: PaymentProviderName.STRIPE,
        event_id: String(parsed.id ?? `evt_stub_${Date.now()}`),
        event_type: String(parsed.type ?? "stub.event"),
        payload: parsed,
      };
    }

    // A live provider (key present) MUST have a webhook secret — otherwise we
    // would accept attacker-forged webhooks. Fail closed.
    if (!this.webhookSecret) {
      throw new AppError({
        status: 401,
        code: ErrorCode.PAYMENT_WEBHOOK_INVALID,
        message: "Stripe webhook secret is not configured",
      });
    }

    if (!signature) {
      throw new AppError({
        status: 401,
        code: ErrorCode.PAYMENT_WEBHOOK_INVALID,
        message: "Missing Stripe webhook signature",
      });
    }

    try {
      const stripe = await this.client();
      const event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        this.webhookSecret,
      );
      return {
        provider: PaymentProviderName.STRIPE,
        event_id: String(event.id),
        event_type: String(event.type),
        payload: JSON.parse(JSON.stringify(event)),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError({
        status: 401,
        code: ErrorCode.PAYMENT_WEBHOOK_INVALID,
        message: "Invalid Stripe webhook signature",
        details: String(err),
      });
    }
  }

  async getStatus(reference: string): Promise<PaymentTransactionResult> {
    if (this.isStub) {
      return {
        provider: PaymentProviderName.STRIPE,
        reference,
        status: PaymentStatus.SUCCEEDED,
        raw: { id: `pi_stub_${reference}`, status: "succeeded", reference, stub: true },
      };
    }

    const stripe = await this.client();
    const intents = await stripe.paymentIntents.search({
      query: `metadata['reference']:'${reference}'`,
      limit: 1,
    });
    const intent = intents?.data?.[0];
    if (!intent) {
      throw new AppError({
        status: 404,
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: "Stripe transaction not found",
        details: { reference },
      });
    }
    const status =
      intent.status === "succeeded" ? PaymentStatus.SUCCEEDED : PaymentStatus.PENDING;
    return {
      provider: PaymentProviderName.STRIPE,
      reference,
      status,
      raw: JSON.parse(JSON.stringify(intent)),
    };
  }

  async refund(reference: string, amountMinor?: number | null): Promise<PaymentTransactionResult> {
    if (this.isStub) {
      return {
        provider: PaymentProviderName.STRIPE,
        reference,
        status: PaymentStatus.REFUNDED,
        raw: {
          id: `re_stub_${reference}`,
          payment_intent: `pi_stub_${reference}`,
          amount: amountMinor ?? null,
          status: "refunded",
          stub: true,
        },
      };
    }

    const tx = await this.getStatus(reference);
    const paymentIntentId = tx.raw.id as string | undefined;
    if (!paymentIntentId) {
      throw new AppError({
        status: 404,
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: "Stripe payment intent not found for refund",
        details: { reference },
      });
    }
    const stripe = await this.client();
    const refundPayload: Record<string, unknown> = { payment_intent: paymentIntentId };
    if (amountMinor != null) refundPayload.amount = amountMinor;
    const refund = await stripe.refunds.create(refundPayload);
    return {
      provider: PaymentProviderName.STRIPE,
      reference,
      status: PaymentStatus.REFUNDED,
      raw: JSON.parse(JSON.stringify(refund)),
    };
  }

  private safeParse(body: string): Record<string, any> {
    try {
      const parsed = JSON.parse(body || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
}
