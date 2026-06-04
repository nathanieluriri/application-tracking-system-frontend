import { withEnvelope } from "@server/http/with-envelope";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { SINGLETON_KEY } from "@server/schemas/settings";
import { verifyDomainForOrg } from "@server/services/sender-domains";

/**
 * Trigger Resend verification for a sender domain, mirrors the FastAPI
 * `POST /sender-domains/{record_id}/verify` endpoint.
 */

export const POST = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(
      req,
      "POST:/sender-domains/{record_id}/verify",
    );
    const { id } = await ctx.params;
    return verifyDomainForOrg(SINGLETON_KEY, String(id));
  },
  { message: "Verification triggered" },
);
