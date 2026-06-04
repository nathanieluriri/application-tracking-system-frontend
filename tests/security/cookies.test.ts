import { describe, it, expect } from "vitest";
import {
  authCookieDirectives,
  clearAuthCookieDirectives,
  shouldReturnTokens,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from "@server/security/cookies";

describe("auth cookie directives", () => {
  it("builds httpOnly lax cookies with env max-ages", () => {
    const dirs = authCookieDirectives("acc", "ref");
    const access = dirs.find((d) => d.name === ACCESS_COOKIE)!;
    const refresh = dirs.find((d) => d.name === REFRESH_COOKIE)!;
    expect(access).toMatchObject({ value: "acc", httpOnly: true, sameSite: "lax", path: "/" });
    expect(access.maxAge).toBe(86400);
    expect(refresh).toMatchObject({ value: "ref", httpOnly: true });
    expect(refresh.maxAge).toBe(2592000);
    // dev/test ⇒ not secure
    expect(access.secure).toBe(false);
  });

  it("skips a missing token", () => {
    const dirs = authCookieDirectives("acc", undefined);
    expect(dirs).toHaveLength(1);
    expect(dirs[0].name).toBe(ACCESS_COOKIE);
  });

  it("clear directives expire both cookies", () => {
    const dirs = clearAuthCookieDirectives();
    expect(dirs).toHaveLength(2);
    expect(dirs.every((d) => d.maxAge === 0)).toBe(true);
  });

  it("shouldReturnTokens honours the opt-in header", () => {
    expect(shouldReturnTokens("true")).toBe(true);
    expect(shouldReturnTokens("0")).toBe(false);
    expect(shouldReturnTokens(null)).toBe(false);
  });
});
