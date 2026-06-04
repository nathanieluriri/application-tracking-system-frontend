import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody, refreshTokenFromRequest } from "@server/http/request";
import { authResponse } from "@server/http/auth-response";
import { requireForRefresh } from "@server/http/guards";
import { authInvalidToken, authRoleMismatch } from "@server/core/errors";
import { adminRefreshSchema } from "@server/schemas/admins";
import { refreshAdminTokens } from "@server/services/admins";

export const POST = withEnvelope(async (req) => {
  const principal = await requireForRefresh(req);
  if (principal.role !== "admin") throw authRoleMismatch("admin", principal.role);

  const body = await parseJsonBody(req, adminRefreshSchema);
  const refreshToken = body.refresh_token || refreshTokenFromRequest(req);
  if (!refreshToken) throw authInvalidToken({ reason: "missing refresh_token" });

  const admin = await refreshAdminTokens(refreshToken, principal.accessTokenId);
  return authResponse(req, admin, "Admin tokens refreshed successfully");
});
