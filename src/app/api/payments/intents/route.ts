import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { requireAny } from "@server/http/guards";
import { paymentIntentInSchema } from "@server/schemas/payments";
import { createPaymentIntent } from "@server/services/payments";

export const POST = withEnvelope(
  async (req) => {
    const principal = await requireAny(req);
    const body = await parseJsonBody(req, paymentIntentInSchema);
    return createPaymentIntent(principal.userId, body);
  },
  { message: "Payment intent created", status: 201 },
);
