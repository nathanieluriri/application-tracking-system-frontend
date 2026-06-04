import { withEnvelope } from "@server/http/with-envelope";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { revokeInvitation } from "@server/services/invitations";

export const POST = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "POST:/invitations/{invitation_id}/revoke");
    const { id } = await ctx.params;
    return revokeInvitation(String(id));
  },
  { message: "Invitation revoked successfully" },
);
