import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { bulkStatusUpdateSchema } from "@server/schemas/applications";
import { bulkUpdateApplicationStatus } from "@server/services/applications";

export const POST = withEnvelope(
  async (req) => {
    const admin = await checkAdminAccountStatusAndPermissions(req, "POST:/applications/bulk/status");
    const payload = await parseJsonBody(req, bulkStatusUpdateSchema);
    const modified = await bulkUpdateApplicationStatus(payload.ids, payload.status, admin.id);
    return { modified };
  },
  { message: "Applications bulk-updated successfully" },
);
