import { describe, it, expect } from "vitest";
import { accessTokenOut, refreshTokenOut, accessTokenCreate } from "@server/schemas/tokens";

describe("token schemas", () => {
  it("accessTokenOut maps _id → accesstoken and defaults role", () => {
    const t = accessTokenOut({ _id: "abc123", userId: "u1", role: "member", dateCreated: 1 });
    expect(t.accesstoken).toBe("abc123");
    expect(t.userId).toBe("u1");
    expect(t.role).toBe("member");
  });

  it("accessTokenOut defaults role to anonymous when absent", () => {
    const t = accessTokenOut({ _id: "x", userId: "u", dateCreated: 1 });
    expect(t.role).toBe("anonymous");
  });

  it("refreshTokenOut maps _id → refreshtoken", () => {
    const t = refreshTokenOut({ _id: "rid", userId: "u", previousAccessToken: "p", dateCreated: 1 });
    expect(t.refreshtoken).toBe("rid");
  });

  it("accessTokenCreate stamps a numeric dateCreated", () => {
    const c = accessTokenCreate("u1");
    expect(c.userId).toBe("u1");
    expect(typeof c.dateCreated).toBe("number");
  });
});
