import { describe, it, expect } from "vitest";
import {
  normalizeRole,
  parseRateRule,
  parseRoleRateLimits,
  buildRoleRateLimitsCsv,
  buildRoleRateLimits,
} from "@server/core/role-config";

describe("role-config", () => {
  it("normalizes legacy member→user, blank→anonymous, case-insensitive", () => {
    expect(normalizeRole("member")).toBe("user");
    expect(normalizeRole("")).toBe("anonymous");
    expect(normalizeRole(null)).toBe("anonymous");
    expect(normalizeRole("ADMIN")).toBe("admin");
  });

  it("parses a rate rule string into amount + window seconds", () => {
    expect(parseRateRule("20/minute")).toEqual({ amount: 20, windowSeconds: 60 });
    expect(parseRateRule("5/second")).toEqual({ amount: 5, windowSeconds: 1 });
    expect(parseRateRule("100/hour")).toEqual({ amount: 100, windowSeconds: 3600 });
  });

  it("parses a CSV of role rules", () => {
    expect(parseRoleRateLimits("anonymous:20/minute, admin:140/minute")).toEqual({
      anonymous: "20/minute",
      admin: "140/minute",
    });
  });

  it("builds a default CSV including anonymous + admin", () => {
    const csv = buildRoleRateLimitsCsv(["user"]);
    expect(csv).toContain("anonymous:");
    expect(csv).toContain("user:");
    expect(csv).toContain("admin:");
  });

  it("always returns anonymous + admin rules even from a partial config", () => {
    const rules = buildRoleRateLimits("user:80/minute", buildRoleRateLimitsCsv(["user"]));
    expect(rules.anonymous).toEqual({ amount: 20, windowSeconds: 60 });
    expect(rules.admin).toEqual({ amount: 140, windowSeconds: 60 });
    expect(rules.user).toEqual({ amount: 80, windowSeconds: 60 });
  });
});
