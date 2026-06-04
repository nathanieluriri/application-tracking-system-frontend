import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseQuery } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { listOutboundEmails } from "@server/services/outbound-emails";

const listQuerySchema = z.object({
  start: z.coerce.number().int().min(0).optional(),
  stop: z.coerce.number().int().positive().optional(),
  sender_admin_id: z.string().optional(),
  application_id: z.string().optional(),
});

export const GET = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/emails");
    const q = parseQuery(req, listQuerySchema);
    return listOutboundEmails(q);
  },
  { message: "Outbound emails fetched successfully" },
);
