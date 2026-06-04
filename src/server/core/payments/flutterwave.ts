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
 * Flutterwave payment provider, mirrors `core/payments/flutterwave_provider.py`.
 *
 * Talks to the Flutterwave v3 REST API via `fetch` (no SDK). When
 * `FLUTTERWAVE_SECRET_KEY` is absent the provider runs in *stub mode*: intents
 * return a synthetic checkout link and webhooks are parsed without verifying the
 * `verif-hash` header.
 */
export class FlutterwavePaymentProvider implements PaymentProvider {
  readonly providerName = PaymentProviderName.FLUTTERWAVE;

  private readonly secretKey: string | null;
  private readonly webhookSecretHash: string | null;
  private readonly baseUrl = "https://api.flutterwave.com/v3";

  constructor(opts: { secretKey?: string | null; webhookSecretHash?: string | null } = {}) {
    this.secretKey = opts.secretKey ?? null;
    this.webhookSecretHash = opts.webhookSecretHash ?? null;
  }

  get isStub(): boolean {
    return !this.secretKey;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/json",
    };
  }

  async createPaymentIntent(payload: PaymentIntentIn): Promise<PaymentIntentResponse> {
    if (this.isStub) {
      return {
        provider: PaymentProviderName.FLUTTERWAVE,
        reference: payload.reference,
        status: PaymentStatus.PENDING,
        checkout_url: `https://checkout.stub.flutterwave/${payload.reference}`,
        provider_payload: {
          status: "success",
          data: {
            link: `https://checkout.stub.flutterwave/${payload.reference}`,
            tx_ref: payload.reference,
          },
          stub: true,
        },
      };
    }

    const metadata = payload.metadata ?? {};
    const response = await fetch(`${this.baseUrl}/payments`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        tx_ref: payload.reference,
        amount: payload.amount_minor / 100,
        currency: payload.currency,
        redirect_url: (metadata as Record<string, unknown>).redirect_url ?? null,
        customer: payload.customer_email ? { email: payload.customer_email } : null,
        meta: metadata,
      }),
    });
    const data = await this.parseJson(response);
    if (response.status >= 400 || data.status !== "success") {
      throw new AppError({
        status: 502,
        code: ErrorCode.PAYMENT_PROVIDER_ERROR,
        message: "Flutterwave intent creation failed",
        details: data,
      });
    }
    const checkoutUrl = (data.data?.link as string | undefined) ?? null;
    return {
      provider: PaymentProviderName.FLUTTERWAVE,
      reference: payload.reference,
      status: PaymentStatus.PENDING,
      checkout_url: checkoutUrl,
      provider_payload: data,
    };
  }

  async verifyAndParseWebhook(
    body: string,
    headers: Record<string, string>,
  ): Promise<WebhookEvent> {
    const provided = headers["verif-hash"] ?? headers["Verif-Hash"];
    const expected = this.webhookSecretHash;
    // Only enforce the hash outside stub mode and when a secret is configured.
    if (!this.isStub && expected && provided !== expected) {
      throw new AppError({
        status: 401,
        code: ErrorCode.PAYMENT_WEBHOOK_INVALID,
        message: "Invalid Flutterwave webhook signature",
      });
    }

    const payload = this.safeParse(body);
    const eventId = String(payload.id ?? payload.tx_ref ?? "unknown");
    const eventType = String(payload.event ?? payload.status ?? "unknown");
    return {
      provider: PaymentProviderName.FLUTTERWAVE,
      event_id: eventId,
      event_type: eventType,
      payload,
    };
  }

  async getStatus(reference: string): Promise<PaymentTransactionResult> {
    if (this.isStub) {
      return {
        provider: PaymentProviderName.FLUTTERWAVE,
        reference,
        status: PaymentStatus.SUCCEEDED,
        raw: {
          status: "success",
          data: { id: `flw_stub_${reference}`, status: "successful", tx_ref: reference },
          stub: true,
        },
      };
    }

    const url = new URL(`${this.baseUrl}/transactions/verify_by_reference`);
    url.searchParams.set("tx_ref", reference);
    const response = await fetch(url.toString(), { method: "GET", headers: this.headers() });
    const data = await this.parseJson(response);
    if (response.status >= 400 || data.status !== "success") {
      throw new AppError({
        status: 502,
        code: ErrorCode.PAYMENT_PROVIDER_ERROR,
        message: "Flutterwave verify failed",
        details: data,
      });
    }
    const status = String(data.data?.status ?? "").toLowerCase();
    const mapped =
      status === "successful" ? PaymentStatus.SUCCEEDED : PaymentStatus.PENDING;
    return {
      provider: PaymentProviderName.FLUTTERWAVE,
      reference,
      status: mapped,
      raw: data,
    };
  }

  async refund(reference: string, amountMinor?: number | null): Promise<PaymentTransactionResult> {
    if (this.isStub) {
      return {
        provider: PaymentProviderName.FLUTTERWAVE,
        reference,
        status: PaymentStatus.REFUNDED,
        raw: {
          status: "success",
          data: { id: `flw_refund_stub_${reference}`, amount: (amountMinor ?? 0) / 100 },
          stub: true,
        },
      };
    }

    const tx = await this.getStatus(reference);
    const transactionId = tx.raw.data?.id;
    if (!transactionId) {
      throw new AppError({
        status: 404,
        code: ErrorCode.PAYMENT_PROVIDER_ERROR,
        message: "Flutterwave transaction not found for refund",
        details: tx.raw,
      });
    }
    const payload: Record<string, unknown> = {};
    if (amountMinor != null) payload.amount = amountMinor / 100;
    const response = await fetch(`${this.baseUrl}/transactions/${transactionId}/refund`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    const data = await this.parseJson(response);
    if (response.status >= 400 || data.status !== "success") {
      throw new AppError({
        status: 502,
        code: ErrorCode.PAYMENT_PROVIDER_ERROR,
        message: "Flutterwave refund failed",
        details: data,
      });
    }
    return {
      provider: PaymentProviderName.FLUTTERWAVE,
      reference,
      status: PaymentStatus.REFUNDED,
      raw: data,
    };
  }

  private async parseJson(response: Response): Promise<Record<string, any>> {
    try {
      const parsed = await response.json();
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
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
