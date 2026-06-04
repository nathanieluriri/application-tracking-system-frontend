import { withEnvelope } from "@server/http/with-envelope";
import { clearAuthResponse } from "@server/http/auth-response";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { removeAdmin } from "@server/services/admins";

export const DELETE = withEnvelope(async (req) => {
  const admin = await checkAdminAccountStatusAndPermissions(req, "DELETE:/admins/account");
  await removeAdmin(admin.id!);
  return clearAuthResponse(req, { deleted: true }, "Admin account deleted successfully");
});
