/**
 * Typed application settings, mirrors the FastAPI `core/settings.py`.
 *
 * `loadSettings(env)` is pure (takes an env map) so it is trivially testable.
 * `getSettings()` memoizes `loadSettings(process.env)` for app/runtime use.
 */

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function splitCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === "") return fallback;
  return TRUTHY.has(value.trim().toLowerCase());
}

function asInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function asFloat(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export interface Settings {
  env: string;
  isProduction: boolean;
  secretKey: string;
  sessionSecretKey: string;

  // auth / cookies
  accessTokenMaxAge: number;
  refreshTokenMaxAge: number;
  accessTokenTtlDays: number;

  // http
  corsOrigins: string[];
  roleRateLimits: string | null;
  debugIncludeErrorDetails: boolean;

  // jobs
  jobBackend: string;

  // email
  emailTransport: string;
  emailHost: string | null;
  emailPort: number;
  emailUsername: string | null;
  emailPassword: string | null;
  emailFromEmail: string | null;
  emailSenderName: string;
  emailRetryAttempts: number;
  emailRetryBackoffSeconds: number;
  emailQueueEnabled: boolean;

  // storage
  storageBackend: string;
  storageLocalRoot: string;
  s3BucketName: string | null;
  s3Region: string | null;
  s3EndpointUrl: string | null;

  // payments
  paymentDefaultProvider: string;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  flutterwaveSecretKey: string | null;
  flutterwavePublicKey: string | null;
  flutterwaveWebhookSecretHash: string | null;

  // database
  mongoUri: string;
  dbName: string;
}

export type EnvMap = Record<string, string | undefined>;

export function loadSettings(env: EnvMap = process.env): Readonly<Settings> {
  const envName = env.ENV || "development";

  const settings: Settings = {
    env: envName,
    isProduction: envName.toLowerCase() === "production",
    secretKey: env.SECRET_KEY || "",
    sessionSecretKey: env.SESSION_SECRET_KEY || "",

    accessTokenMaxAge: asInt(env.ACCESS_TOKEN_MAX_AGE_SECONDS, 24 * 3600),
    refreshTokenMaxAge: asInt(env.REFRESH_TOKEN_MAX_AGE_SECONDS, 30 * 24 * 3600),
    accessTokenTtlDays: asInt(env.ACCESS_TOKEN_TTL_DAYS, 10),

    corsOrigins: splitCsv(env.CORS_ORIGINS),
    roleRateLimits: env.ROLE_RATE_LIMITS || null,
    debugIncludeErrorDetails: asBool(env.DEBUG_INCLUDE_ERROR_DETAILS, false),

    jobBackend: (env.JOB_BACKEND || "inline").toLowerCase(),

    emailTransport: (env.EMAIL_TRANSPORT || "console").toLowerCase(),
    emailHost: env.EMAIL_HOST || null,
    emailPort: asInt(env.EMAIL_PORT, 587),
    emailUsername: env.EMAIL_USERNAME || null,
    emailPassword: env.EMAIL_PASSWORD || null,
    emailFromEmail: env.EMAIL_FROM_EMAIL || null,
    emailSenderName: env.EMAIL_SENDER_NAME || "ATS",
    emailRetryAttempts: asInt(env.EMAIL_RETRY_ATTEMPTS, 3),
    emailRetryBackoffSeconds: asFloat(env.EMAIL_RETRY_BACKOFF_SECONDS, 1.0),
    emailQueueEnabled: asBool(env.EMAIL_QUEUE_ENABLED, true),

    storageBackend: (env.STORAGE_BACKEND || "local").toLowerCase(),
    storageLocalRoot: env.STORAGE_LOCAL_ROOT || "./.storage",
    s3BucketName: env.S3_BUCKET_NAME || null,
    s3Region: env.S3_REGION || null,
    s3EndpointUrl: env.S3_ENDPOINT_URL || null,

    paymentDefaultProvider: (env.PAYMENT_DEFAULT_PROVIDER || "stripe").toLowerCase(),
    stripeSecretKey: env.STRIPE_SECRET_KEY || null,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || null,
    flutterwaveSecretKey: env.FLUTTERWAVE_SECRET_KEY || null,
    flutterwavePublicKey: env.FLUTTERWAVE_PUBLIC_KEY || null,
    flutterwaveWebhookSecretHash: env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || null,

    mongoUri: env.MONGODB_URI || env.MONGO_URL || "mongodb://localhost:27017",
    dbName: env.DB_NAME || "ats",
  };

  return Object.freeze(settings);
}

let cached: Readonly<Settings> | null = null;

export function getSettings(): Readonly<Settings> {
  if (cached === null) {
    cached = loadSettings(process.env);
  }
  return cached;
}

/** Test-only: drop the memoized settings so a fresh env can be read. */
export function resetSettingsCache(): void {
  cached = null;
}
