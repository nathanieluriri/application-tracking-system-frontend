import { SignJWT, jwtVerify, decodeJwt, errors as joseErrors } from "jose";
import { getSettings } from "@server/core/settings";

/**
 * Cookie JWT mint/decode, mirrors the role-token half of
 * `security/encrypting_jwt.py`. Payload embeds the access-token record id so
 * the token resolver can look the record up in Mongo.
 */

export interface RoleTokenClaims {
  accessToken: string; // the access-token record id
  userId: string;
  role: string;
}

const ALG = "HS256";
const DEFAULT_EXPIRES_SECONDS = 15 * 60; // matches the FastAPI 15-minute token

function secretKey(): Uint8Array {
  const secret = getSettings().secretKey || "dev-only-insecure-secret";
  return new TextEncoder().encode(secret);
}

export async function signRoleToken(
  claims: RoleTokenClaims,
  opts: { expiresInSeconds?: number } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.expiresInSeconds ?? DEFAULT_EXPIRES_SECONDS);
  return new SignJWT({ accessToken: claims.accessToken, role: claims.role, userId: claims.userId })
    .setProtectedHeader({ alg: ALG, typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secretKey());
}

export interface DecodedRoleToken {
  accessToken?: string;
  userId?: string;
  role?: string;
  [key: string]: unknown;
}

export async function decodeToken(token: string): Promise<DecodedRoleToken | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG] });
    return payload as DecodedRoleToken;
  } catch {
    return null;
  }
}

/**
 * Verify the signature but tolerate an expired `exp`. jose checks the signature
 * before claims, so an `ERR_JWT_EXPIRED` means the signature was already valid —
 * we can then read the payload without the exp check.
 */
export async function decodeTokenAllowExpired(token: string): Promise<DecodedRoleToken | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG] });
    return payload as DecodedRoleToken;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      try {
        return decodeJwt(token) as DecodedRoleToken;
      } catch {
        return null;
      }
    }
    return null;
  }
}
