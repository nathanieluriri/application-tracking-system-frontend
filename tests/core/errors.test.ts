import { describe, it, expect } from "vitest";
import {
  AppError,
  ErrorCode,
  authInvalidToken,
  authRoleMismatch,
  authPermissionDenied,
  resourceNotFound,
} from "@server/core/errors";

describe("AppError", () => {
  it("carries status, code, message, details, headers", () => {
    const e = new AppError({
      status: 403,
      code: ErrorCode.AUTH_PERMISSION_DENIED,
      message: "no",
      details: { k: 1 },
      headers: { "Retry-After": "5" },
    });
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(403);
    expect(e.code).toBe("AUTH_PERMISSION_DENIED");
    expect(e.message).toBe("no");
    expect(e.details).toEqual({ k: 1 });
    expect(e.headers).toEqual({ "Retry-After": "5" });
  });

  it("authInvalidToken → 401", () => {
    const e = authInvalidToken();
    expect(e.status).toBe(401);
    expect(e.code).toBe(ErrorCode.AUTH_INVALID_TOKEN);
  });

  it("authRoleMismatch → 403 with roles in details", () => {
    const e = authRoleMismatch("admin", "user");
    expect(e.status).toBe(403);
    expect(e.code).toBe(ErrorCode.AUTH_ROLE_MISMATCH);
    expect(e.details).toMatchObject({ required_role: "admin", actual_role: "user" });
  });

  it("authPermissionDenied → 403 with key", () => {
    const e = authPermissionDenied("GET:/v1/x");
    expect(e.status).toBe(403);
    expect(e.details).toMatchObject({ permission_key: "GET:/v1/x" });
  });

  it("resourceNotFound → 404 with resource + id", () => {
    const e = resourceNotFound("Application", "abc");
    expect(e.status).toBe(404);
    expect(e.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    expect(e.message).toBe("Application not found");
    expect(e.details).toMatchObject({ resource: "Application", resource_id: "abc" });
  });
});
