import { normalizeRole } from "@server/core/role-config";
import {
  generateMemberAccessToken,
  generateAdminAccessToken,
  generateRefreshToken,
} from "@server/security/tokens";

/**
 * Issue an access JWT + refresh token id for a principal, mirrors
 * `services/auth_helpers.py` (`issue_tokens_for_role`).
 */
export async function issueTokensForRole(
  userId: string,
  role: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const normalized = normalizeRole(role);
  const accessRec =
    normalized === "admin"
      ? await generateAdminAccessToken(userId)
      : await generateMemberAccessToken(userId);

  const accessToken = accessRec.accesstoken!;
  const refreshRec = await generateRefreshToken(userId, accessToken);
  return { accessToken, refreshToken: refreshRec.refreshtoken! };
}
