import { ObjectId } from "mongodb";
import { AppError, ErrorCode } from "@server/core/errors";
import {
  addAccessToken,
  addAdminAccessToken,
  addRefreshToken,
} from "@server/repositories/tokens";
import { signRoleToken, decodeToken } from "@server/security/jwt";
import type { AccessTokenRecord, RefreshTokenRecord } from "@server/schemas/tokens";

/**
 * Token minting + refresh issuance, mirrors `security/tokens.py`. A token is a
 * Mongo record whose id is embedded in a signed JWT (the cookie value).
 */

function assertValidUserId(userId: string): void {
  try {
    new ObjectId(userId);
  } catch {
    throw new AppError({
      status: 401,
      code: ErrorCode.AUTH_INVALID_TOKEN,
      message: "Invalid User Id",
    });
  }
}

export async function generateMemberAccessToken(userId: string): Promise<AccessTokenRecord> {
  assertValidUserId(userId);
  const rec = await addAccessToken(userId);
  const jwt = await signRoleToken({ accessToken: rec.accesstoken!, userId, role: "user" });
  return { ...rec, accesstoken: jwt };
}

export async function generateAdminAccessToken(userId: string): Promise<AccessTokenRecord> {
  assertValidUserId(userId);
  const rec = await addAdminAccessToken(userId);
  const jwt = await signRoleToken({ accessToken: rec.accesstoken!, userId, role: "admin" });
  return { ...rec, accesstoken: jwt };
}

export async function generateRefreshToken(
  userId: string,
  accessJwt: string,
): Promise<RefreshTokenRecord> {
  assertValidUserId(userId);
  const decoded = await decodeToken(accessJwt);
  if (!decoded || !decoded.accessToken) {
    throw new AppError({
      status: 401,
      code: ErrorCode.AUTH_INVALID_TOKEN,
      message: "Failed to decode the access token while creating a refresh token",
    });
  }
  return addRefreshToken(userId, String(decoded.accessToken));
}
