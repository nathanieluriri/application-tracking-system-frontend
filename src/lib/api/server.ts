import "server-only";
import { cookies, headers } from "next/headers";

interface ServerFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
}

/**
 * RSC fetcher. Calls this app's own in-process `/api/*` route handlers
 * (same origin) and forwards the caller's auth cookies. Legacy `/v1/*` paths
 * are transparently mapped to `/api/*` so existing RSC pages keep working after
 * the backend was migrated into Next.js.
 */
export async function serverFetch<T = unknown>(
  path: string,
  init: ServerFetchOptions = {},
): Promise<{ status: number; data: T | null }> {
  const cookieStore = await cookies();
  const access = cookieStore.get("access_token")?.value;
  const refresh = cookieStore.get("refresh_token")?.value;
  const reqHeaders = await headers();

  const cookieParts: string[] = [];
  if (access) cookieParts.push(`access_token=${access}`);
  if (refresh) cookieParts.push(`refresh_token=${refresh}`);

  const finalHeaders: Record<string, string> = {
    accept: "application/json",
    ...(init.headers ?? {}),
  };
  if (cookieParts.length > 0) finalHeaders.cookie = cookieParts.join("; ");
  const xff = reqHeaders.get("x-forwarded-for");
  if (xff) finalHeaders["x-forwarded-for"] = xff;

  // Map legacy FastAPI paths (/v1/...) onto the in-process API (/api/...).
  let apiPath = path;
  if (path.startsWith("/v1/")) apiPath = `/api/${path.slice(4)}`;

  let url = apiPath;
  if (!apiPath.startsWith("http")) {
    const host = reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host") ?? "localhost:3000";
    const proto = reqHeaders.get("x-forwarded-proto") ?? "http";
    url = `${proto}://${host}${apiPath}`;
  }

  const res = await fetch(url, { ...init, headers: finalHeaders, cache: "no-store" });

  if (!res.ok) {
    return { status: res.status, data: null };
  }

  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null;
  }
  return { status: res.status, data };
}
