import { withEnvelope } from "@server/http/with-envelope";
import { requireAny } from "@server/http/guards";
import { authPermissionDenied } from "@server/core/errors";
import { getPaymentTransaction } from "@server/services/payments";

export const GET = withEnvelope(
  async (req, ctx) => {
    const principal = await requireAny(req);
    const { id } = await ctx.params;
    const tx = await getPaymentTransaction(String(id));
    if (tx.owner_id !== principal.userId && !principal.isAdmin) {
      throw authPermissionDenied("GET:/payments/{payment_id}");
    }
    return tx;
  },
  { message: "Payment transaction fetched" },
);
