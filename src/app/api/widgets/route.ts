import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody, parseQuery } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { widgetCreateSchema } from "@server/schemas/widgets";
import { addWidget, retrieveWidgets } from "@server/services/widgets";

const listQuerySchema = z.object({
  start: z.coerce.number().int().min(0).optional(),
  stop: z.coerce.number().int().positive().optional(),
});

export const GET = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/widgets");
    const q = parseQuery(req, listQuerySchema);
    return retrieveWidgets(q.start ?? 0, q.stop ?? 100);
  },
  { message: "Widgets fetched successfully" },
);

export const POST = withEnvelope(
  async (req) => {
    const admin = await checkAdminAccountStatusAndPermissions(req, "POST:/widgets");
    const body = await parseJsonBody(req, widgetCreateSchema);
    return addWidget(body, admin.id!);
  },
  { message: "Widget created successfully", status: 201 },
);
