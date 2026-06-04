import type { ZodType } from "zod";
import { AppError, ErrorCode } from "@server/core/errors";
import { authInputFromHeaders, type AuthInput } from "@server/security/auth";
import { REFRESH_COOKIE } from "@server/security/cookies";

function cookieValue(req: Request, name: string): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export function refreshTokenFromRequest(req: Request): string | null {
  return cookieValue(req, REFRESH_COOKIE);
}

/**
 * Next-aware request helpers used by route-handler controllers. These read the
 * Web `Request` (NextRequest extends it) so they stay easy to unit-test.
 */

export function authInputFromRequest(req: Request): AuthInput {
  return authInputFromHeaders({
    authorization: req.headers.get("authorization"),
    cookie: req.headers.get("cookie"),
  });
}

export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") || crypto.randomUUID();
}

function validationError(issues: unknown): AppError {
  return new AppError({
    status: 422,
    code: ErrorCode.VALIDATION_FAILED,
    message: "Validation error",
    details: { errors: issues },
  });
}

export async function parseJsonBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw validationError(result.error.issues);
  return result.data;
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  const result = schema.safeParse(obj);
  if (!result.success) throw validationError(result.error.issues);
  return result.data;
}
