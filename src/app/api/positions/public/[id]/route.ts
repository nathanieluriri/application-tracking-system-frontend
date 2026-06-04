import { withEnvelope } from "@server/http/with-envelope";
import { retrievePublicPositionById } from "@server/services/positions";

/** Public single open role — used by the hosted careers detail page. No auth. */
export const GET = withEnvelope(
  async (_req, ctx) => {
    const { id } = await ctx.params;
    return retrievePublicPositionById(String(id));
  },
  { message: "Position fetched successfully" },
);
