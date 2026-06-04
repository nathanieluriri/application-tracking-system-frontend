import { withEnvelope } from "@server/http/with-envelope";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { outboundStats } from "@server/services/outbound-emails";

export const GET = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/emails/stats");
    return outboundStats();
  },
  { message: "Outbound email stats fetched successfully" },
);
