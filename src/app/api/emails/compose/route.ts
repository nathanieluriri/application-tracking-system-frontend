import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { outboundEmailCreateSchema } from "@server/schemas/outbound-emails";
import { composeAndSend } from "@server/services/outbound-emails";

export const POST = withEnvelope(
  async (req) => {
    const admin = await checkAdminAccountStatusAndPermissions(req, "POST:/emails/compose");
    const body = await parseJsonBody(req, outboundEmailCreateSchema);
    const records = await composeAndSend(body, admin.id!);
    return { queued: records.length, records };
  },
  { message: "Emails enqueued successfully", status: 202 },
);
