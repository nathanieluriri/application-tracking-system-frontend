import "server-only";
import { NextResponse } from "next/server";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
}
