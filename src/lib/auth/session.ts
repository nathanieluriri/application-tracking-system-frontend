import "server-only";
import { cookies } from "next/headers";

export interface SessionInfo {
  authenticated: boolean;
  /** Decoded JWT payload, if available. NOT verified — FastAPI is the source of truth. */
  payload?: Record<string, unknown> | null;
}

function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded + padding, "base64").toString("utf-8");
  }
  return atob(padded + padding);
}

function tryDecodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionInfo> {
  const cookieStore = await cookies();
  const access = cookieStore.get("access_token")?.value;
  if (!access) return { authenticated: false };
  return { authenticated: true, payload: tryDecodeJwtPayload(access) };
}
