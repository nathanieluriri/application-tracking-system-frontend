import { describe, it, expect } from "vitest";
import { loadSettings } from "@server/core/settings";

describe("settings", () => {
  it("parses CSV, booleans, ints and exposes isProduction", () => {
    const s = loadSettings({
      ENV: "production",
      SECRET_KEY: "sk",
      CORS_ORIGINS: "http://a.com, http://b.com",
      EMAIL_QUEUE_ENABLED: "true",
      DEBUG_INCLUDE_ERROR_DETAILS: "false",
      ACCESS_TOKEN_MAX_AGE_SECONDS: "111",
      ROLE_RATE_LIMITS: "anonymous:5/minute",
    });

    expect(s.isProduction).toBe(true);
    expect(s.secretKey).toBe("sk");
    expect(s.corsOrigins).toEqual(["http://a.com", "http://b.com"]);
    expect(s.emailQueueEnabled).toBe(true);
    expect(s.debugIncludeErrorDetails).toBe(false);
    expect(s.accessTokenMaxAge).toBe(111);
    expect(s.roleRateLimits).toBe("anonymous:5/minute");
  });

  it("applies dev defaults when env is empty", () => {
    const s = loadSettings({});
    expect(s.env).toBe("development");
    expect(s.isProduction).toBe(false);
    expect(s.corsOrigins).toEqual([]);
    expect(s.emailSenderName).toBe("ATS");
    expect(s.accessTokenMaxAge).toBe(24 * 3600);
    expect(s.refreshTokenMaxAge).toBe(30 * 24 * 3600);
    expect(s.accessTokenTtlDays).toBe(10);
    expect(s.storageBackend).toBe("local");
    expect(s.jobBackend).toBe("inline");
    expect(s.emailTransport).toBe("console");
    expect(s.paymentDefaultProvider).toBe("stripe");
  });
});
