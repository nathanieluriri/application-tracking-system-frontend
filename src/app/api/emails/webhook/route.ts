import { createHmac, timingSafeEqual } from "node:crypto";
import { withEnvelope } from "@server/http/with-envelope";
import { AppError, ErrorCode } from "@server/core/errors";
import { handleResendWebhookEvent } from "@server/services/outbound-emails";

/**
 * Public Resend webhook receiver, mirrors the FastAPI
 * `POST /emails/webhook` endpoint. No auth guard — authenticity is established
 * by the HMAC-SHA256 signature over the raw body when RESEND_WEBHOOK_SECRET is
 * configured.
 */

function verifyResendSignature(secret: string, body: string, signature: string | null): boolean {
  if (!signature) return false;
  const digest = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const expected = Buffer.from(digest, "utf8");
  const provided = Buffer.from(signature, "utf8");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export const POST = withEnvelope(
  async (req) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    const body = await req.text();
    const isProduction = (process.env.ENV ?? "development").toLowerCase() === "production";

    if (secret) {
      const signature = req.headers.get("svix-signature");
      if (!verifyResendSignature(secret, body, signature)) {
        throw new AppError({
          status: 401,
          code: ErrorCode.AUTH_INVALID_TOKEN,
          message: "Invalid webhook signature",
        });
      }
    } else if (isProduction) {
      // Fail closed in production: never accept unauthenticated, status-mutating
      // webhooks. The bypass below is only for local/dev convenience.
      throw new AppError({
        status: 503,
        code: ErrorCode.AUTH_INVALID_TOKEN,
        message: "Webhook secret is not configured",
      });
    }

    let event: Record<string, any>;
    try {
      event = JSON.parse(body || "{}");
    } catch {
      throw new AppError({
        status: 400,
        code: ErrorCode.VALIDATION_FAILED,
        message: "Invalid JSON body",
      });
    }

    const handled = await handleResendWebhookEvent(event);
    return { handled };
  },
  { message: "Webhook received" },
);
