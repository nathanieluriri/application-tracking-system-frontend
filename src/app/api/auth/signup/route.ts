import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { authResponse } from "@server/http/auth-response";
import { userSignupSchema } from "@server/schemas/users";
import { addUser } from "@server/services/users";

export const POST = withEnvelope(async (req) => {
  const body = await parseJsonBody(req, userSignupSchema);
  const user = await addUser(body);
  return authResponse(req, user, "User created successfully", 201);
});
