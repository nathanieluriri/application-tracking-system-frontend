import { badRequest, conflict, notFound, unauthorized } from "@server/core/errors";
import { isValidObjectId, toObjectId, LoginType } from "@server/schemas/common";
import {
  createUser,
  getUser,
  getUsers,
  deleteUser,
} from "@server/repositories/users";
import {
  userCreateDoc,
  publicUser,
  type UserOut,
  type UserSignup,
  type UserLogin,
} from "@server/schemas/users";
import { hashPassword, checkPassword } from "@server/security/hash";
import { issueTokensForRole } from "@server/security/issue-tokens";
import { defaultUserPermissions } from "@server/security/permission-registry";
import {
  getRefreshToken,
  deleteAccessToken,
  deleteRefreshToken,
  deleteAllTokensForUser,
} from "@server/repositories/tokens";

/**
 * User business logic, mirrors `services/user_service.py`.
 */

async function attachTokens(user: UserOut): Promise<UserOut> {
  const { accessToken, refreshToken } = await issueTokensForRole(user.id!, "user");
  user.access_token = accessToken;
  user.refresh_token = refreshToken;
  return publicUser(user);
}

export async function addUser(input: UserSignup): Promise<UserOut> {
  const existing = await getUser({ email: input.email });
  if (existing) throw conflict("User Already exists");
  const passwordHash = await hashPassword(input.password);
  const user = await createUser(
    userCreateDoc({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      loginType: input.loginType ?? LoginType.email,
      passwordHash,
      permissionList: defaultUserPermissions(),
    }),
  );
  return attachTokens(user);
}

export async function authenticateUser(input: UserLogin): Promise<UserOut> {
  const user = await getUser({ email: input.email });
  if (!user) throw notFound("User not found");
  const ok = await checkPassword(input.password, user.password ?? "");
  if (!ok) throw unauthorized("Unauthorized, Invalid Login credentials");
  return attachTokens(user);
}

export async function refreshUserTokens(
  refreshToken: string,
  expiredAccessTokenId: string,
): Promise<UserOut> {
  const refreshObj = await getRefreshToken(refreshToken);
  if (refreshObj) {
    if (refreshObj.previousAccessToken === expiredAccessTokenId) {
      const oid = toObjectId(refreshObj.userId);
      const user = oid ? await getUser({ _id: oid }) : null;
      if (user) {
        const issued = await attachTokens(user);
        await deleteAccessToken(expiredAccessTokenId);
        await deleteRefreshToken(refreshToken);
        return issued;
      }
    }
    // Stale / mismatched refresh: invalidate both sides.
    await deleteRefreshToken(refreshToken);
    await deleteAccessToken(expiredAccessTokenId);
  }
  throw notFound("Invalid refresh token");
}

export async function removeUser(userId: string): Promise<{ deleted: boolean }> {
  if (!isValidObjectId(userId)) throw badRequest("Invalid user ID format");
  const result = await deleteUser({ _id: toObjectId(userId)! });
  await deleteAllTokensForUser(userId);
  if (result.deletedCount === 0) throw notFound("User not found");
  return { deleted: true };
}

export async function retrieveUserById(id: string): Promise<UserOut> {
  if (!isValidObjectId(id)) throw badRequest("Invalid user ID format");
  const user = await getUser({ _id: toObjectId(id)! });
  if (!user) throw notFound("User not found");
  return user;
}

export async function retrieveUsers(start = 0, stop = 100): Promise<UserOut[]> {
  return getUsers(start, stop);
}
