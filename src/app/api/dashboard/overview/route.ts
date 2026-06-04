import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseQuery } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { getOverviewMetrics } from "@server/services/dashboard";

const querySchema = z.object({
  force_refresh: z.string().optional(),
});

export const GET = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/dashboard/overview");
    const { force_refresh } = parseQuery(req, querySchema);
    const refresh = force_refresh === "true" || force_refresh === "1";
    return getOverviewMetrics(refresh);
  },
  { message: "Dashboard overview fetched successfully" },
);
