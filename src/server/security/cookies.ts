import { getSettings } from "@server/core/settings";

/**
 * Auth cookie directives, mirrors `security/cookies.py`. Framework-neutral:
 * returns plain directive objects a controller applies to a NextResponse via
 * `res.cookies.set(...)`. Cookie names + flags are a wire contract.
 */

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
export const RETURN_TOKENS_HEADER = "x-return-tokens";

export interface CookieDirective {
  name: string;
  value: string;
  maxAge: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
}

function directive(name: string, value: string, maxAge: number): CookieDirective {
  return {
    name,
    value,
    maxAge,
    httpOnly: true,
    secure: getSettings().isProduction,
    sameSite: "lax",
    path: "/",
  };
}

export function authCookieDirectives(
  accessToken?: string | null,
  refreshToken?: string | null,
): CookieDirective[] {
  const s = getSettings();
  const dirs: CookieDirective[] = [];
  if (accessToken) dirs.push(directive(ACCESS_COOKIE, accessToken, s.accessTokenMaxAge));
  if (refreshToken) dirs.push(directive(REFRESH_COOKIE, refreshToken, s.refreshTokenMaxAge));
  return dirs;
}

export function clearAuthCookieDirectives(): CookieDirective[] {
  return [directive(ACCESS_COOKIE, "", 0), directive(REFRESH_COOKIE, "", 0)];
}

export function shouldReturnTokens(headerValue: string | null | undefined): boolean {
  const value = (headerValue ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(value);
}
