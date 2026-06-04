import "server-only";
import { cookies, headers } from "next/headers";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://localhost:8000";

interface ServerFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
}

/**
 * RSC fetcher. Calls FastAPI directly (not via /api) so RSC pages don't loop
 * through their own BFF route handlers — but it forwards the same auth cookies.
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

  const upstream = path.startsWith("http") ? path : `${FASTAPI_BASE_URL}${path}`;
  const res = await fetch(upstream, {
    ...init,
    headers: finalHeaders,
    cache: "no-store",
  });

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
