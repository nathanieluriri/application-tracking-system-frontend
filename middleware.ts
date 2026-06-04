import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "access_token";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

const PUBLIC_PREFIXES = [
  // All API routes bypass the page auth-gate: the route handlers enforce auth
  // themselves and return a 401 JSON envelope (never a 302 HTML redirect),
  // which the client honours (incl. public endpoints + silent refresh).
  "/api",
  "/_next",
  "/favicon.ico",
  "/static",
  "/images",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const access = req.cookies.get(ACCESS_COOKIE)?.value;

  if (isPublic(pathname)) {
    // If already authenticated, bounce away from auth pages
    if (access && PUBLIC_PATHS.includes(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard/overview";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!access) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static asset extensions handled by
     * Next directly. The middleware itself decides what's public.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
  ],
};
