import { withEnvelope } from "@server/http/with-envelope";
import { checkUserAccountStatusAndPermissions } from "@server/security/account-status";

export const GET = withEnvelope(
  async (req) => {
    return checkUserAccountStatusAndPermissions(req, "GET:/users/me");
  },
  { message: "User profile fetched successfully" },
);
