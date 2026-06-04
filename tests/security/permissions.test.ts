import { describe, it, expect } from "vitest";
import { makePermissionKey, hasPermission } from "@server/security/permissions";

describe("permission keys", () => {
  it("normalizes the path and uppercases the method", () => {
    expect(makePermissionKey("get", "/v1/applications/")).toBe("GET:/v1/applications");
    expect(makePermissionKey("POST", "applications//bulk/")).toBe("POST:/applications/bulk");
    expect(makePermissionKey("delete", "/")).toBe("DELETE:/");
  });

  it("matches by key", () => {
    const list = { permissions: [{ key: "GET:/v1/x", name: "get_x", methods: ["GET"], path: "/v1/x" }] };
    expect(hasPermission(list, { key: "GET:/v1/x", name: "get_x", method: "GET" })).toBe(true);
    expect(hasPermission(list, { key: "GET:/v1/y", name: "get_y", method: "GET" })).toBe(false);
  });

  it("falls back to legacy name+method match", () => {
    const list = { permissions: [{ name: "get_x", methods: ["GET"], path: "/v1/x" }] };
    expect(hasPermission(list, { key: "GET:/v1/x", name: "get_x", method: "GET" })).toBe(true);
    expect(hasPermission(list, { key: "GET:/v1/x", name: "get_x", method: "POST" })).toBe(false);
  });
});
