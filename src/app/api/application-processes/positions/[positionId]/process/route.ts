import { withEnvelope } from "@server/http/with-envelope";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { resolveProcessForPosition } from "@server/services/application-process";

export const GET = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(
      req,
      "GET:/application-processes/positions/{position_id}/process",
    );
    const { positionId } = await ctx.params;
    return resolveProcessForPosition(String(positionId));
  },
  { message: "Application process resolved successfully" },
);
