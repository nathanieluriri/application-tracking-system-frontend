import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody, refreshTokenFromRequest } from "@server/http/request";
import { authResponse } from "@server/http/auth-response";
import { requireForRefresh } from "@server/http/guards";
import { authInvalidToken, authRoleMismatch } from "@server/core/errors";
import { userRefreshSchema } from "@server/schemas/users";
import { refreshUserTokens } from "@server/services/users";

export const POST = withEnvelope(async (req) => {
  const principal = await requireForRefresh(req);
  if (principal.role !== "user") throw authRoleMismatch("user", principal.role);

  const body = await parseJsonBody(req, userRefreshSchema);
  const refreshToken = body.refresh_token || refreshTokenFromRequest(req);
  if (!refreshToken) throw authInvalidToken({ reason: "missing refresh_token" });

  const user = await refreshUserTokens(refreshToken, principal.accessTokenId);
  return authResponse(req, user, "Tokens refreshed successfully");
});
