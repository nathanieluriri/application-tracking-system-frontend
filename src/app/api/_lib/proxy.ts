import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://localhost:8000";

interface ForwardOptions {
  method?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
  /** Override the access token (used by silent-refresh retry) */
  accessTokenOverride?: string;
  /** Don't read body — useful for GET/HEAD that already passes body=undefined */
  noBody?: boolean;
}

function buildUpstreamHeaders(
  req: Request,
  init?: ForwardOptions,
  accessOverride?: string,
  refreshOverride?: string,
  cookieAccess?: string,
  cookieRefresh?: string,
): Headers {
  const headers = new Headers(init?.headers);

  // Forward content-type and other body-relevant headers from the original request
  const contentType = req.headers.get("content-type");
  if (contentType && !headers.has("content-type")) {
    headers.set("content-type", contentType);
  }
  const accept = req.headers.get("accept");
  if (accept && !headers.has("accept")) {
    headers.set("accept", accept);
  }

  // Strip any Cookie that may have leaked in via init.headers — we control it
  headers.delete("cookie");

  const access = accessOverride ?? cookieAccess;
  const refresh = refreshOverride ?? cookieRefresh;
  const cookieParts: string[] = [];
  if (access) cookieParts.push(`${ACCESS_COOKIE}=${access}`);
  if (refresh) cookieParts.push(`${REFRESH_COOKIE}=${refresh}`);
  if (cookieParts.length > 0) {
    headers.set("cookie", cookieParts.join("; "));
  }

  const xff = req.headers.get("x-forwarded-for") ?? "";
  if (xff) headers.set("x-forwarded-for", xff);
  const requestId = req.headers.get("x-request-id");
  if (requestId) headers.set("x-request-id", requestId);

  // The browser doesn't send these to FastAPI directly, but a few endpoints
  // care about real-IP / referrer.
  const realIp = req.headers.get("x-real-ip");
  if (realIp) headers.set("x-real-ip", realIp);

  return headers;
}

async function copyResponseHeaders(upstream: Response, target: Headers) {
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // content-encoding/transfer-encoding will be set by Next anyway
    if (lower === "content-encoding" || lower === "transfer-encoding" || lower === "connection") {
      return;
    }
    target.append(key, value);
  });
}

async function executeUpstream(
  req: Request,
  path: string,
  init: ForwardOptions,
  accessOverride: string | undefined,
  refreshOverride: string | undefined,
  cookieAccess: string | undefined,
  cookieRefresh: string | undefined,
): Promise<Response> {
  const headers = buildUpstreamHeaders(
    req,
    init,
    accessOverride,
    refreshOverride,
    cookieAccess,
    cookieRefresh,
  );

  const fetchInit: RequestInit & { duplex?: "half" } = {
    method: init.method ?? req.method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };

  if (!init.noBody && init.body !== undefined) {
    fetchInit.body = init.body ?? null;
    fetchInit.duplex = "half";
  }

  return fetch(`${FASTAPI_BASE_URL}${path}`, fetchInit);
}

export async function forwardToFastAPI(
  req: Request,
  path: string,
  init: ForwardOptions = {},
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const cookieAccess = cookieStore.get(ACCESS_COOKIE)?.value;
  const cookieRefresh = cookieStore.get(REFRESH_COOKIE)?.value;

  let upstream = await executeUpstream(
    req,
    path,
    init,
    init.accessTokenOverride,
    undefined,
    cookieAccess,
    cookieRefresh,
  );

  // Silent refresh on 401, but only if we have a refresh cookie and the
  // request wasn't itself an auth call.
  const isAuthPath = path.startsWith("/v1/users/login")
    || path.startsWith("/v1/admins/login")
    || path.startsWith("/v1/users/refresh")
    || path.startsWith("/v1/admins/refresh")
    || path.startsWith("/v1/users/signup")
    || path.startsWith("/v1/admins/signup");

  if (upstream.status === 401 && cookieRefresh && !isAuthPath) {
    const refreshHeaders = new Headers();
    refreshHeaders.set("content-type", "application/json");
    refreshHeaders.set("cookie", `${REFRESH_COOKIE}=${cookieRefresh}`);
    if (cookieAccess) {
      refreshHeaders.append("cookie", `${ACCESS_COOKIE}=${cookieAccess}`);
    }

    const refreshResp = await fetch(`${FASTAPI_BASE_URL}/v1/users/refresh`, {
      method: "POST",
      headers: refreshHeaders,
      body: "{}",
      redirect: "manual",
      cache: "no-store",
    });

    if (refreshResp.ok) {
      const setCookieHeaders = refreshResp.headers.getSetCookie?.() ?? [];
      const newAccess = extractCookieFromSetCookie(setCookieHeaders, ACCESS_COOKIE);
      const newRefresh = extractCookieFromSetCookie(setCookieHeaders, REFRESH_COOKIE);

      // Retry the original upstream call with new cookies
      const retried = await executeUpstream(
        req,
        path,
        init,
        newAccess ?? cookieAccess,
        newRefresh ?? cookieRefresh,
        cookieAccess,
        cookieRefresh,
      );
      const proxied = new NextResponse(retried.body, {
        status: retried.status,
        statusText: retried.statusText,
      });
      // Carry refresh-cycle Set-Cookies onto the response
      for (const sc of setCookieHeaders) {
        proxied.headers.append("set-cookie", sc);
      }
      await copyResponseHeaders(retried, proxied.headers);
      return proxied;
    }

    // Refresh failed — clear cookies and pass through 401
    const cleared = new NextResponse(upstream.body, {
      status: 401,
      statusText: upstream.statusText,
    });
    cleared.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
    cleared.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
    await copyResponseHeaders(upstream, cleared.headers);
    return cleared;
  }

  const out = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
  });
  await copyResponseHeaders(upstream, out.headers);
  return out;
}

function extractCookieFromSetCookie(setCookies: string[], name: string): string | null {
  for (const sc of setCookies) {
    const firstPair = sc.split(";")[0];
    const eqIndex = firstPair.indexOf("=");
    if (eqIndex === -1) continue;
    const cookieName = firstPair.slice(0, eqIndex).trim();
    if (cookieName === name) {
      return firstPair.slice(eqIndex + 1).trim();
    }
  }
  return null;
}
