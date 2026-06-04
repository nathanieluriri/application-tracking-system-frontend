import { withEnvelope } from "@server/http/with-envelope";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { resendInvitation } from "@server/services/invitations";

export const POST = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "POST:/invitations/{invitation_id}/resend");
    const { id } = await ctx.params;
    return resendInvitation(String(id));
  },
  { message: "Invitation resent successfully" },
);
