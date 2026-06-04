import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { authResponse } from "@server/http/auth-response";
import { invitationAcceptSchema } from "@server/schemas/invitations";
import { acceptInvitation } from "@server/services/invitations";

export const POST = withEnvelope(async (req) => {
  const body = await parseJsonBody(req, invitationAcceptSchema);
  const newAdmin = await acceptInvitation(body);
  return authResponse(req, newAdmin, "Invitation accepted successfully", 201);
});
