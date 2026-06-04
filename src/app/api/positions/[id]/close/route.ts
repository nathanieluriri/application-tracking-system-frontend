import { withEnvelope } from "@server/http/with-envelope";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { closePosition } from "@server/services/positions";

export const POST = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "POST:/positions/{position_id}/close");
    const { id } = await ctx.params;
    return closePosition(String(id));
  },
  { message: "Position closed successfully" },
);
