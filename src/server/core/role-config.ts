/**
 * Role normalization and role-aware rate-limit rules, mirrors
 * `core/role_config.py`. A rule is `{ amount, windowSeconds }` (the Redis
 * `limits` library is replaced by a Mongo fixed-window limiter).
 */

export interface RateRule {
  amount: number;
  windowSeconds: number;
}

export const DEFAULT_ANONYMOUS_RATE = "20/minute";
export const DEFAULT_ROLE_RATE = "80/minute";
export const DEFAULT_ADMIN_RATE = "140/minute";

const LEGACY_ROLE_ALIASES: Record<string, string> = { member: "user" };

const WINDOW_SECONDS: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
};

export function normalizeRole(role: string | null | undefined): string {
  const value = (role ?? "anonymous").trim().toLowerCase() || "anonymous";
  return LEGACY_ROLE_ALIASES[value] ?? value;
}

/** Parse `"20/minute"` → `{ amount: 20, windowSeconds: 60 }`. */
export function parseRateRule(rule: string): RateRule {
  const [amountRaw, unitRaw] = rule.split("/");
  const amount = Number.parseInt(amountRaw.trim(), 10);
  let unit = (unitRaw ?? "minute").trim().toLowerCase();
  // Tolerate plural / shorthand forms ("minutes", "min").
  if (unit.endsWith("s")) unit = unit.slice(0, -1);
  if (unit === "min") unit = "minute";
  if (unit === "sec") unit = "second";
  if (unit === "hr") unit = "hour";
  const windowSeconds = WINDOW_SECONDS[unit] ?? 60;
  if (Number.isNaN(amount)) throw new Error(`Invalid rate rule: ${rule}`);
  return { amount, windowSeconds };
}

export function parseRoleRateLimits(raw: string | null | undefined): Record<string, string> {
  const parsed: Record<string, string> = {};
  if (!raw) return parsed;
  for (const entry of raw.split(",")) {
    const value = entry.trim();
    if (!value || !value.includes(":")) continue;
    const idx = value.indexOf(":");
    const role = normalizeRole(value.slice(0, idx));
    const limit = value.slice(idx + 1).trim();
    if (role && limit) parsed[role] = limit;
  }
  return parsed;
}

export function buildRoleRateLimitsCsv(nonAdminRoles: string[], includeAdmin = true): string {
  const entries = [`anonymous:${DEFAULT_ANONYMOUS_RATE}`];
  for (const role of nonAdminRoles) entries.push(`${normalizeRole(role)}:${DEFAULT_ROLE_RATE}`);
  if (includeAdmin) entries.push(`admin:${DEFAULT_ADMIN_RATE}`);
  return entries.join(",");
}

export function buildRoleRateLimits(
  raw: string | null | undefined,
  fallbackCsv: string,
): Record<string, RateRule> {
  const configured = parseRoleRateLimits(raw);
  const fallback = parseRoleRateLimits(fallbackCsv);
  const selected = Object.keys(configured).length > 0 ? configured : fallback;

  if (!("anonymous" in selected)) selected.anonymous = DEFAULT_ANONYMOUS_RATE;
  if (!("admin" in selected)) selected.admin = DEFAULT_ADMIN_RATE;

  const final: Record<string, RateRule> = {};
  for (const [role, rule] of Object.entries(selected)) {
    try {
      final[role] = parseRateRule(rule);
    } catch {
      // skip malformed rule
    }
  }
  if (!("anonymous" in final)) final.anonymous = parseRateRule(DEFAULT_ANONYMOUS_RATE);
  return final;
}
