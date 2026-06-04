import { verifyUser, verifyAdmin, verifyAny, verifyForRefresh } from "@server/security/auth";
import type { AuthPrincipal } from "@server/security/principal";
import { authInputFromRequest } from "./request";

/**
 * Next-aware auth guards: compose `security/auth` with the request. Role-level
 * checks only; account-status + permission enforcement is layered on in Stage 2
 * once the user/admin repositories exist.
 */

export function requireUser(req: Request): Promise<AuthPrincipal> {
  return verifyUser(authInputFromRequest(req));
}

export function requireAdmin(req: Request): Promise<AuthPrincipal> {
  return verifyAdmin(authInputFromRequest(req));
}

export function requireAny(req: Request): Promise<AuthPrincipal> {
  return verifyAny(authInputFromRequest(req));
}

export function requireForRefresh(req: Request): Promise<AuthPrincipal> {
  return verifyForRefresh(authInputFromRequest(req));
}

export async function optionalAuth(req: Request): Promise<AuthPrincipal | null> {
  try {
    return await verifyAny(authInputFromRequest(req));
  } catch {
    return null;
  }
}
