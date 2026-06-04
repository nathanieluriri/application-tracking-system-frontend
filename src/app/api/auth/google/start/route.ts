import { type NextRequest, NextResponse } from "next/server";
import { googleIsConfigured, googleAuthUrl } from "@server/security/google-oauth";

const STATE_COOKIE = "g_oauth_state";

export function GET(req: NextRequest) {
  if (!googleIsConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_unavailable", req.url));
  }

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? new URL("/api/auth/google/callback", req.url).toString();
  const state = crypto.randomUUID();

  const res = NextResponse.redirect(googleAuthUrl(redirectUri, state));
  // Short-lived CSRF state cookie, verified in the callback.
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
