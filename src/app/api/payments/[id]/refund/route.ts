import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { requireAny } from "@server/http/guards";
import { authPermissionDenied } from "@server/core/errors";
import { refundInSchema } from "@server/schemas/payments";
import { getPaymentTransaction, refundPayment } from "@server/services/payments";

export const POST = withEnvelope(
  async (req, ctx) => {
    const principal = await requireAny(req);
    const { id } = await ctx.params;
    const body = await parseJsonBody(req, refundInSchema);
    const tx = await getPaymentTransaction(String(id));
    if (tx.owner_id !== principal.userId && !principal.isAdmin) {
      throw authPermissionDenied("POST:/payments/{payment_id}/refund");
    }
    return refundPayment(String(id), body.amount_minor ?? null);
  },
  { message: "Payment refunded" },
);
