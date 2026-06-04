"use client";

export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: { page?: number; limit?: number; total?: number } | null;
  requestId?: string | null;
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? "GET",
    credentials: "include",
    headers: { accept: "application/json", ...(options.headers ?? {}) },
    signal: options.signal,
  };

  if (options.body !== undefined && options.body !== null) {
    if (options.body instanceof FormData) {
      init.body = options.body;
    } else {
      (init.headers as Record<string, string>)["content-type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
  }

  const res = await fetch(path, init);

  if (res.status === 401 && typeof window !== "undefined") {
    // BFF already attempted silent refresh; failing 401 means the user is out.
    const next = window.location.pathname + window.location.search;
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await res.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const err: ApiError = Object.assign(
      new Error(payload?.message ?? `Request failed with ${res.status}`),
      {
        status: res.status,
        code: (payload as unknown as { data?: { code?: string } } | null)?.data?.code,
        details: (payload as unknown as { data?: { details?: unknown } } | null)?.data?.details,
      },
    );
    throw err;
  }

  if (!payload) {
    throw Object.assign(new Error("Empty response body"), { status: res.status }) as ApiError;
  }

  return payload.data;
}
