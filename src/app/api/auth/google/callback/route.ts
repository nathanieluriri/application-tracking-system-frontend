import { type NextRequest, NextResponse } from "next/server";
import {
  googleIsConfigured,
  googleExchangeCode,
  googleFetchProfile,
} from "@server/security/google-oauth";
import { authenticateUserGoogle } from "@server/services/users";
import { authCookieDirectives } from "@server/security/cookies";

const STATE_COOKIE = "g_oauth_state";

function loginError(req: NextRequest, reason: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?error=${reason}`, req.url));
}

export async function GET(req: NextRequest) {
  if (!googleIsConfigured()) return loginError(req, "google_unavailable");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code) return loginError(req, "google_no_code");
  if (!state || !expectedState || state !== expectedState) {
    return loginError(req, "google_bad_state");
  }

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? new URL("/api/auth/google/callback", req.url).toString();

  const tokens = await googleExchangeCode(code, redirectUri);
  if (!tokens?.access_token) return loginError(req, "google_exchange_failed");

  const profile = await googleFetchProfile(tokens.access_token);
  if (!profile?.email) return loginError(req, "google_no_profile");

  const user = await authenticateUserGoogle({
    email: profile.email,
    firstName: profile.given_name ?? profile.name ?? profile.email,
    lastName: profile.family_name ?? "",
  });

  const res = NextResponse.redirect(new URL("/dashboard/overview", req.url));
  for (const d of authCookieDirectives(user.access_token, user.refresh_token)) {
    res.cookies.set(d.name, d.value, {
      maxAge: d.maxAge,
      httpOnly: d.httpOnly,
      secure: d.secure,
      sameSite: d.sameSite,
      path: d.path,
    });
  }
  res.cookies.set(STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
  return res;
}
