import { describe, it, expect } from "vitest";
import { signRoleToken, decodeToken, decodeTokenAllowExpired } from "@server/security/jwt";

describe("jwt role tokens", () => {
  it("round-trips accessToken / userId / role claims", async () => {
    const jwt = await signRoleToken({ accessToken: "rec1", userId: "u1", role: "admin" });
    const decoded = await decodeToken(jwt);
    expect(decoded).toMatchObject({ accessToken: "rec1", userId: "u1", role: "admin" });
  });

  it("returns null for a malformed/tampered token", async () => {
    expect(await decodeToken("not.a.jwt")).toBeNull();
    const jwt = await signRoleToken({ accessToken: "r", userId: "u", role: "user" });
    expect(await decodeToken(jwt + "x")).toBeNull();
  });

  it("rejects an expired token with decodeToken but reads it with allow-expired", async () => {
    const jwt = await signRoleToken(
      { accessToken: "r", userId: "u", role: "user" },
      { expiresInSeconds: -10 },
    );
    expect(await decodeToken(jwt)).toBeNull();
    expect(await decodeTokenAllowExpired(jwt)).toMatchObject({ userId: "u", role: "user" });
  });
});
