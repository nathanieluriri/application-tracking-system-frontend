/**
 * Token record shapes + normalizers, mirrors `schemas/tokens_schema.py`.
 * These are internal DB shapes (not request bodies), so they are plain
 * interfaces + mapper functions rather than zod request schemas.
 */

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export interface AccessTokenRecord {
  userId: string;
  dateCreated: number;
  role: string;
  status?: string;
  /** str(_id) on read; replaced with the signed JWT after generation. */
  accesstoken: string | null;
}

export interface RefreshTokenRecord {
  userId: string;
  previousAccessToken: string;
  dateCreated: number;
  refreshtoken: string | null;
}

export function accessTokenCreate(userId: string): { userId: string; dateCreated: number } {
  return { userId, dateCreated: nowSeconds() };
}

export function refreshTokenCreate(
  userId: string,
  previousAccessToken: string,
): { userId: string; previousAccessToken: string; dateCreated: number } {
  return { userId, previousAccessToken, dateCreated: nowSeconds() };
}

export function accessTokenOut(doc: Record<string, any>): AccessTokenRecord {
  const id = doc._id != null ? String(doc._id) : null;
  // An explicit `accessToken` field wins (admin-token path), else str(_id).
  const accesstoken = doc.accessToken ? String(doc.accessToken) : id;
  return {
    userId: doc.userId,
    dateCreated: doc.dateCreated,
    role: doc.role ?? "anonymous",
    status: doc.status,
    accesstoken,
  };
}

export function refreshTokenOut(doc: Record<string, any>): RefreshTokenRecord {
  const id = doc._id != null ? String(doc._id) : null;
  return {
    userId: doc.userId,
    previousAccessToken: doc.previousAccessToken,
    dateCreated: doc.dateCreated,
    refreshtoken: id,
  };
}
