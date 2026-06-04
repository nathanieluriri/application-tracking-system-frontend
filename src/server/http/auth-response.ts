import { NextResponse } from "next/server";
import { successEnvelope } from "@server/core/response-envelope";
import {
  authCookieDirectives,
  clearAuthCookieDirectives,
  shouldReturnTokens,
  RETURN_TOKENS_HEADER,
  type CookieDirective,
} from "@server/security/cookies";
import { getRequestId } from "./request";

/**
 * Build envelope responses that also set/clear the auth cookies, mirroring the
 * FastAPI `_apply_auth_response` + `clear_auth_cookies` helpers. Tokens are
 * omitted from the JSON body unless the caller opts in via X-Return-Tokens.
 */

interface Tokenful {
  access_token: string | null;
  refresh_token: string | null;
}

function applyCookies(res: NextResponse, dirs: CookieDirective[]): void {
  for (const d of dirs) {
    res.cookies.set(d.name, d.value, {
      maxAge: d.maxAge,
      httpOnly: d.httpOnly,
      secure: d.secure,
      sameSite: d.sameSite,
      path: d.path,
    });
  }
}

export function authResponse<T extends Tokenful>(
  req: Request,
  entity: T,
  message: string,
  status = 200,
): NextResponse {
  const accessToken = entity.access_token;
  const refreshToken = entity.refresh_token;

  const body = { ...entity } as Record<string, unknown>;
  if (!shouldReturnTokens(req.headers.get(RETURN_TOKENS_HEADER))) {
    body.access_token = null;
    body.refresh_token = null;
  }

  const requestId = getRequestId(req);
  const res = NextResponse.json(successEnvelope(body, message, { requestId }), {
    status,
    headers: { "X-Request-ID": requestId },
  });
  applyCookies(res, authCookieDirectives(accessToken, refreshToken));
  return res;
}

export function clearAuthResponse(req: Request, data: unknown, message: string): NextResponse {
  const requestId = getRequestId(req);
  const res = NextResponse.json(successEnvelope(data, message, { requestId }), {
    headers: { "X-Request-ID": requestId },
  });
  applyCookies(res, clearAuthCookieDirectives());
  return res;
}
