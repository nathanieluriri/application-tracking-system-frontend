import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { emailTemplateUpdateSchema } from "@server/schemas/email-templates";
import {
  retrieveEmailTemplateById,
  updateEmailTemplateById,
  removeEmailTemplate,
} from "@server/services/email-templates";

export const GET = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/email-templates/{template_id}");
    const { id } = await ctx.params;
    return retrieveEmailTemplateById(String(id));
  },
  { message: "Email template fetched successfully" },
);

export const PATCH = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "PATCH:/email-templates/{template_id}");
    const { id } = await ctx.params;
    const body = await parseJsonBody(req, emailTemplateUpdateSchema);
    return updateEmailTemplateById(String(id), body);
  },
  { message: "Email template updated successfully" },
);

export const DELETE = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "DELETE:/email-templates/{template_id}");
    const { id } = await ctx.params;
    return removeEmailTemplate(String(id));
  },
  { message: "Email template deleted successfully" },
);
