import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { applicationProcessUpdateSchema } from "@server/schemas/application-process";
import {
  retrieveApplicationProcessById,
  updateApplicationProcessById,
  removeApplicationProcess,
} from "@server/services/application-process";

export const GET = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/application-processes/{process_id}");
    const { id } = await ctx.params;
    return retrieveApplicationProcessById(String(id));
  },
  { message: "Application process fetched successfully" },
);

export const PATCH = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "PATCH:/application-processes/{process_id}");
    const { id } = await ctx.params;
    const body = await parseJsonBody(req, applicationProcessUpdateSchema);
    return updateApplicationProcessById(String(id), body);
  },
  { message: "Application process updated successfully" },
);

export const DELETE = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "DELETE:/application-processes/{process_id}");
    const { id } = await ctx.params;
    return removeApplicationProcess(String(id));
  },
  { message: "Application process deleted successfully" },
);
