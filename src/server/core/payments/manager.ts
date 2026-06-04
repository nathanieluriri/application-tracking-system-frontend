import { AppError, ErrorCode } from "@server/core/errors";
import { getSettings } from "@server/core/settings";
import { FlutterwavePaymentProvider } from "./flutterwave";
import { StripePaymentProvider } from "./stripe";
import { PaymentProviderName, type PaymentProvider } from "./provider";

/**
 * Payment provider registry, mirrors `core/payments/manager.py`.
 *
 * Unlike the FastAPI manager (which only registers providers that have keys and
 * raises if none are configured), this manager always registers both Stripe and
 * Flutterwave providers — each runs in *stub mode* when its secret key is
 * absent. This matches the FastAPI lifespan that tolerates missing payment
 * config: the app boots fine, and a provider only fails when a real call needs
 * a key it doesn't have. The manager never throws at construction; it throws
 * only when an unsupported provider name is requested.
 */
export class PaymentManager {
  private static instance: PaymentManager | null = null;

  private constructor(
    private readonly providers: Map<string, PaymentProvider>,
    private readonly defaultProvider: string,
  ) {}

  static configureFromSettings(): PaymentManager {
    const settings = getSettings();
    const providers = new Map<string, PaymentProvider>();

    providers.set(
      PaymentProviderName.STRIPE,
      new StripePaymentProvider({
        secretKey: settings.stripeSecretKey,
        webhookSecret: settings.stripeWebhookSecret,
      }),
    );
    providers.set(
      PaymentProviderName.FLUTTERWAVE,
      new FlutterwavePaymentProvider({
        secretKey: settings.flutterwaveSecretKey,
        webhookSecretHash: settings.flutterwaveWebhookSecretHash,
      }),
    );

    let defaultProvider = settings.paymentDefaultProvider;
    if (!providers.has(defaultProvider)) {
      defaultProvider = providers.keys().next().value as string;
    }

    PaymentManager.instance = new PaymentManager(providers, defaultProvider);
    return PaymentManager.instance;
  }

  static getInstance(): PaymentManager {
    if (PaymentManager.instance === null) {
      return PaymentManager.configureFromSettings();
    }
    return PaymentManager.instance;
  }

  /** Test-only: drop the memoized manager so fresh settings can be read. */
  static reset(): void {
    PaymentManager.instance = null;
  }

  getProvider(name?: string | null): PaymentProvider {
    const key = (name || this.defaultProvider).toLowerCase();
    const provider = this.providers.get(key);
    if (!provider) {
      throw new AppError({
        status: 400,
        code: ErrorCode.PAYMENT_PROVIDER_ERROR,
        message: `Unsupported payment provider '${name}'`,
        details: { provider: name ?? null },
      });
    }
    // Fail closed in production: a stub (keyless) provider must never mint fake
    // payments or accept unverified webhooks in a live deployment. Dev/test keep
    // stub mode so the app boots and tests run without payment keys.
    if (provider.isStub && getSettings().isProduction) {
      throw new AppError({
        status: 503,
        code: ErrorCode.PAYMENT_PROVIDER_ERROR,
        message: `Payment provider '${key}' is not configured`,
        details: { provider: key },
      });
    }
    return provider;
  }
}
