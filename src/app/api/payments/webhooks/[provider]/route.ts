import { withEnvelope } from "@server/http/with-envelope";
import { processWebhook } from "@server/services/payments";

/**
 * PUBLIC: receive payment webhooks for a specific provider (stripe | flutterwave).
 * No auth guard — provider authenticity is verified via the signature/hash
 * inside the provider's `verifyAndParseWebhook`.
 */
export const POST = withEnvelope(
  async (req, ctx) => {
    const { provider } = await ctx.params;
    const body = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return processWebhook(String(provider), body, headers);
  },
  { message: "Webhook processed" },
);
