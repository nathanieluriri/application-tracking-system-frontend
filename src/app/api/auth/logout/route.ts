import { withEnvelope } from "@server/http/with-envelope";
import { clearAuthResponse } from "@server/http/auth-response";

export const POST = withEnvelope(async (req) => {
  return clearAuthResponse(req, { logged_out: true }, "Logged out successfully");
});
