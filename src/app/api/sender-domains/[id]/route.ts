import { withEnvelope } from "@server/http/with-envelope";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { SINGLETON_KEY } from "@server/schemas/settings";
import { deleteDomainForOrg, refreshDomainForOrg } from "@server/services/sender-domains";

/**
 * Single sender-domain admin routes, mirrors `api/v1/sender_domain_route.py`.
 * GET re-fetches the latest status from Resend (the FastAPI `refresh` endpoint);
 * DELETE removes the domain from Resend and locally.
 */

export const GET = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/sender-domains/{record_id}");
    const { id } = await ctx.params;
    return refreshDomainForOrg(SINGLETON_KEY, String(id));
  },
  { message: "Sender domain fetched successfully" },
);

export const DELETE = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "DELETE:/sender-domains/{record_id}");
    const { id } = await ctx.params;
    const deleted = await deleteDomainForOrg(SINGLETON_KEY, String(id));
    return { deleted };
  },
  { message: "Domain removed" },
);
