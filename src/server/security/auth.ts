import { authInvalidToken, authRoleMismatch } from "@server/core/errors";
import { normalizeRole } from "@server/core/role-config";
import { getAccessToken } from "@server/repositories/tokens";
import { makePrincipal, type AuthPrincipal, type Role } from "@server/security/principal";
import { ACCESS_COOKIE } from "@server/security/cookies";

/**
 * Principal resolution + role guards, mirrors `security/auth.py`.
 * Framework-neutral: takes the bits a request exposes (bearer header + cookie),
 * so it runs under Vitest without Next.
 */

export interface AuthInput {
  authorization?: string | null;
  accessTokenCookie?: string | null;
}

export interface ResolveOptions {
  requireRole?: Role;
  allowExpired?: boolean;
}

const AUTH_ROLES = new Set<string>(["user", "admin"]);

export function extractJwt(input: AuthInput): string {
  const auth = input.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length);
  }
  if (input.accessTokenCookie) {
    return input.accessTokenCookie;
  }
  throw authInvalidToken();
}

export async function resolvePrincipal(
  input: AuthInput,
  opts: ResolveOptions = {},
): Promise<AuthPrincipal> {
  const allowExpired = opts.allowExpired ?? false;
  const jwt = extractJwt(input);

  const record = await getAccessToken(jwt, { allowExpired });
  if (!record) throw authInvalidToken();

  const role = normalizeRole(record.role);
  if (!AUTH_ROLES.has(role)) throw authInvalidToken({ role: record.role });

  if (opts.requireRole && role !== opts.requireRole) {
    throw authRoleMismatch(opts.requireRole, role);
  }

  return makePrincipal({
    userId: record.userId,
    role: role as Role,
    accessTokenId: record.accesstoken ?? "",
    jwtToken: jwt,
    allowExpired,
  });
}

export const verifyUser = (input: AuthInput): Promise<AuthPrincipal> =>
  resolvePrincipal(input, { requireRole: "user" });

export const verifyAdmin = (input: AuthInput): Promise<AuthPrincipal> =>
  resolvePrincipal(input, { requireRole: "admin" });

export const verifyAny = (input: AuthInput): Promise<AuthPrincipal> => resolvePrincipal(input, {});

export const verifyForRefresh = (input: AuthInput): Promise<AuthPrincipal> =>
  resolvePrincipal(input, { allowExpired: true });

/** Helper: build an AuthInput from a Cookie header + Authorization header. */
export function authInputFromHeaders(headers: {
  authorization?: string | null;
  cookie?: string | null;
}): AuthInput {
  let accessTokenCookie: string | null = null;
  const cookie = headers.cookie;
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === ACCESS_COOKIE) accessTokenCookie = rest.join("=");
    }
  }
  return { authorization: headers.authorization ?? null, accessTokenCookie };
}
