import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { positionUpdateSchema } from "@server/schemas/positions";
import { retrievePositionById, updatePositionById, removePosition } from "@server/services/positions";

export const GET = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/positions/{position_id}");
    const { id } = await ctx.params;
    return retrievePositionById(String(id));
  },
  { message: "Position fetched successfully" },
);

export const PATCH = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "PATCH:/positions/{position_id}");
    const { id } = await ctx.params;
    const body = await parseJsonBody(req, positionUpdateSchema);
    return updatePositionById(String(id), body);
  },
  { message: "Position updated successfully" },
);

export const DELETE = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "DELETE:/positions/{position_id}");
    const { id } = await ctx.params;
    return removePosition(String(id));
  },
  { message: "Position deleted successfully" },
);
