import { ObjectId } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { getSettings } from "@server/core/settings";
import { decodeToken, decodeTokenAllowExpired } from "@server/security/jwt";
import {
  accessTokenCreate,
  accessTokenOut,
  refreshTokenCreate,
  refreshTokenOut,
  nowSeconds,
  type AccessTokenRecord,
  type RefreshTokenRecord,
} from "@server/schemas/tokens";

/**
 * Access / refresh token persistence, mirrors `repositories/tokens_repo.py`.
 * The JWT in the cookie carries the access-token record id; resolving a token
 * means decoding the JWT (or accepting a raw id) and loading the record.
 */

function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function isOlderThanDays(dateSeconds: number, days: number): boolean {
  return nowSeconds() - dateSeconds > days * 86400;
}

export async function addAccessToken(userId: string): Promise<AccessTokenRecord> {
  const db = await getDb();
  const doc = { ...accessTokenCreate(userId), role: "member" };
  const res = await db.collection(COLLECTIONS.accessToken).insertOne(doc);
  return accessTokenOut({ ...doc, _id: res.insertedId });
}

export async function addAdminAccessToken(userId: string): Promise<AccessTokenRecord> {
  const db = await getDb();
  const doc = { ...accessTokenCreate(userId), role: "admin", status: "active" };
  const res = await db.collection(COLLECTIONS.accessToken).insertOne(doc);
  return accessTokenOut({ ...doc, _id: res.insertedId });
}

export async function addRefreshToken(
  userId: string,
  previousAccessToken: string,
): Promise<RefreshTokenRecord> {
  const db = await getDb();
  const doc = refreshTokenCreate(userId, previousAccessToken);
  const res = await db.collection(COLLECTIONS.refreshToken).insertOne(doc);
  return refreshTokenOut({ ...doc, _id: res.insertedId });
}

async function resolveAccessTokenId(jwtOrId: string, allowExpired: boolean): Promise<string | null> {
  const decoded = allowExpired ? await decodeTokenAllowExpired(jwtOrId) : await decodeToken(jwtOrId);
  if (decoded && decoded.accessToken) return String(decoded.accessToken);
  // Fall back to treating the value as a raw record id.
  return toObjectId(jwtOrId) ? jwtOrId : null;
}

export async function getAccessToken(
  jwtOrId: string,
  opts: { allowExpired?: boolean } = {},
): Promise<AccessTokenRecord | null> {
  const allowExpired = opts.allowExpired ?? false;
  const tokenId = await resolveAccessTokenId(jwtOrId, allowExpired);
  if (!tokenId) return null;
  const oid = toObjectId(tokenId);
  if (!oid) return null;

  const db = await getDb();
  const record = await db.collection(COLLECTIONS.accessToken).findOne({ _id: oid });
  if (!record) return null;

  if (!allowExpired && isOlderThanDays(record.dateCreated, getSettings().accessTokenTtlDays)) {
    await db.collection(COLLECTIONS.accessToken).deleteOne({ _id: oid });
    return null;
  }
  if (record.role === "admin" && record.status !== "active") return null;

  return accessTokenOut(record);
}

export async function getAccessTokenAllowExpired(jwtOrId: string): Promise<AccessTokenRecord | null> {
  return getAccessToken(jwtOrId, { allowExpired: true });
}

export async function getRefreshToken(refreshId: string): Promise<RefreshTokenRecord | null> {
  const oid = toObjectId(refreshId);
  if (!oid) return null;
  const db = await getDb();
  const record = await db.collection(COLLECTIONS.refreshToken).findOne({ _id: oid });
  return record ? refreshTokenOut(record) : null;
}

export async function deleteAccessToken(id: string): Promise<void> {
  const oid = toObjectId(id);
  if (!oid) return;
  const db = await getDb();
  await db.collection(COLLECTIONS.accessToken).deleteOne({ _id: oid });
}

export async function deleteRefreshToken(id: string): Promise<void> {
  const oid = toObjectId(id);
  if (!oid) return;
  const db = await getDb();
  await db.collection(COLLECTIONS.refreshToken).deleteOne({ _id: oid });
}

export async function deleteAllTokensForUser(userId: string): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTIONS.refreshToken).deleteMany({ userId });
  await db.collection(COLLECTIONS.accessToken).deleteMany({ userId });
}
