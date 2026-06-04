import { describe, it, expect } from "vitest";
import { makePrincipal } from "@server/security/principal";

describe("auth principal", () => {
  it("derives role booleans for admin", () => {
    const p = makePrincipal({ userId: "u", role: "admin", accessTokenId: "a", jwtToken: "j" });
    expect(p.isAdmin).toBe(true);
    expect(p.isUser).toBe(false);
  });

  it("derives role booleans for user and defaults allowExpired", () => {
    const p = makePrincipal({ userId: "u", role: "user", accessTokenId: "a", jwtToken: "j" });
    expect(p.isUser).toBe(true);
    expect(p.isAdmin).toBe(false);
    expect(p.allowExpired).toBe(false);
  });
});
