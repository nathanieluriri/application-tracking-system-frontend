import { withEnvelope } from "@server/http/with-envelope";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";

export const GET = withEnvelope(
  async (req) => {
    return checkAdminAccountStatusAndPermissions(req, "GET:/admins/profile");
  },
  { message: "Admin profile fetched successfully" },
);
