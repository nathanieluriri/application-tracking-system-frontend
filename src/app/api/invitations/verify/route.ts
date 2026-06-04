import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseQuery } from "@server/http/request";
import { verifyInvitationToken } from "@server/services/invitations";

const verifyQuerySchema = z.object({
  token: z.string().min(10),
});

export const GET = withEnvelope(
  async (req) => {
    const { token } = parseQuery(req, verifyQuerySchema);
    return verifyInvitationToken(token);
  },
  { message: "Invitation verified successfully" },
);
