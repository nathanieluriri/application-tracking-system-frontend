import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody, parseQuery } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { emailTemplateCreateSchema } from "@server/schemas/email-templates";
import { addEmailTemplate, retrieveEmailTemplates } from "@server/services/email-templates";

const listQuerySchema = z.object({
  start: z.coerce.number().int().min(0).optional(),
  stop: z.coerce.number().int().positive().optional(),
});

export const GET = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/email-templates");
    const q = parseQuery(req, listQuerySchema);
    return retrieveEmailTemplates(q.start ?? 0, q.stop ?? 100);
  },
  { message: "Email templates fetched successfully" },
);

export const POST = withEnvelope(
  async (req) => {
    const admin = await checkAdminAccountStatusAndPermissions(req, "POST:/email-templates");
    const body = await parseJsonBody(req, emailTemplateCreateSchema);
    return addEmailTemplate(body, admin.id);
  },
  { message: "Email template created successfully", status: 201 },
);
