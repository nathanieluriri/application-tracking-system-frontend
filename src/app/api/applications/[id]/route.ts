import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { applicationUpdateSchema } from "@server/schemas/applications";
import {
  retrieveApplication,
  updateApplicationStatus,
  patchApplication,
  removeApplication,
} from "@server/services/applications";

export const GET = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/applications/{application_id}");
    const { id } = await ctx.params;
    return retrieveApplication(String(id));
  },
  { message: "Application fetched successfully" },
);

export const PATCH = withEnvelope(
  async (req, ctx) => {
    const admin = await checkAdminAccountStatusAndPermissions(
      req,
      "PATCH:/applications/{application_id}",
    );
    const { id } = await ctx.params;
    const applicationId = String(id);
    const payload = await parseJsonBody(req, applicationUpdateSchema);

    if (payload.status != null) {
      await updateApplicationStatus(applicationId, payload.status, admin.id);
    }
    await patchApplication(applicationId, payload);
    return retrieveApplication(applicationId);
  },
  { message: "Application updated successfully" },
);

export const DELETE = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "DELETE:/applications/{application_id}");
    const { id } = await ctx.params;
    return removeApplication(String(id));
  },
  { message: "Application deleted successfully" },
);
