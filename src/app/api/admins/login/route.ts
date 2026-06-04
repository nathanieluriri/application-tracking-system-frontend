import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { authResponse } from "@server/http/auth-response";
import { adminLoginSchema } from "@server/schemas/admins";
import { authenticateAdmin } from "@server/services/admins";

export const POST = withEnvelope(async (req) => {
  const body = await parseJsonBody(req, adminLoginSchema);
  const admin = await authenticateAdmin(body);
  return authResponse(req, admin, "Admin login successful");
});
