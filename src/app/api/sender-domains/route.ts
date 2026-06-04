import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { SINGLETON_KEY } from "@server/schemas/settings";
import { senderDomainCreateSchema } from "@server/schemas/sender-domains";
import { createDomainForOrg, listDomainsForOrg } from "@server/services/sender-domains";

/**
 * Sender-domain admin routes, mirrors `api/v1/sender_domain_route.py`.
 * Org scoping uses the singleton org id until admins carry a real `org_id`
 * (matches the FastAPI `get_org_id` / `DEFAULT_ORG_ID = "singleton"`).
 */

export const GET = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/sender-domains");
    return listDomainsForOrg(SINGLETON_KEY);
  },
  { message: "Sender domains fetched successfully" },
);

export const POST = withEnvelope(
  async (req) => {
    const admin = await checkAdminAccountStatusAndPermissions(req, "POST:/sender-domains");
    const body = await parseJsonBody(req, senderDomainCreateSchema);
    return createDomainForOrg(SINGLETON_KEY, admin.id, body);
  },
  { message: "Domain created. Add the DNS records, then verify.", status: 201 },
);
