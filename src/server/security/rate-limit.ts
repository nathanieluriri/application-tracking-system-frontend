import { getDb, COLLECTIONS } from "@server/core/database";
import type { RateRule } from "@server/core/role-config";

/**
 * Mongo-backed fixed-window rate limiter, replacing the Redis `limits` library.
 * Each (id, window) pair is one document with an atomic `$inc` counter and a
 * TTL index so old windows self-expire.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
}

let indexEnsured = false;

async function ensureTtlIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = await getDb();
  await db
    .collection(COLLECTIONS.rateLimits)
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  indexEnsured = true;
}

export async function hitRateLimit(id: string, rule: RateRule): Promise<RateLimitResult> {
  await ensureTtlIndex();
  const db = await getDb();

  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / rule.windowSeconds) * rule.windowSeconds;
  const windowEnd = windowStart + rule.windowSeconds;
  const key = `${id}:${windowStart}`;

  const doc = await db.collection(COLLECTIONS.rateLimits).findOneAndUpdate(
    { _id: key as unknown as never },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(windowEnd * 1000) },
    },
    { upsert: true, returnDocument: "after" },
  );

  const count = (doc?.count as number | undefined) ?? 1;
  const allowed = count <= rule.amount;
  const remaining = Math.max(rule.amount - count, 0);
  const retryAfterSeconds = allowed ? 0 : Math.max(windowEnd - now, 0);

  return { allowed, remaining, retryAfterSeconds, limit: rule.amount };
}

/** Test-only: reset the memoized index flag between in-memory servers. */
export function resetRateLimitIndexCache(): void {
  indexEnsured = false;
}
