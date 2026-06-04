import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { authResponse } from "@server/http/auth-response";
import { userLoginSchema } from "@server/schemas/users";
import { authenticateUser } from "@server/services/users";

export const POST = withEnvelope(async (req) => {
  const body = await parseJsonBody(req, userLoginSchema);
  const user = await authenticateUser(body);
  return authResponse(req, user, "Login successful");
});
