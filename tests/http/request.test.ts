import { describe, it, expect } from "vitest";
import { z } from "zod";
import { authInputFromRequest, getRequestId, parseJsonBody, parseQuery } from "@server/http/request";

describe("request helpers", () => {
  it("extracts bearer + access cookie", () => {
    const req = new Request("http://x", {
      headers: { authorization: "Bearer abc", cookie: "access_token=ck; other=1" },
    });
    const input = authInputFromRequest(req);
    expect(input.authorization).toBe("Bearer abc");
    expect(input.accessTokenCookie).toBe("ck");
  });

  it("uses the incoming x-request-id or generates one", () => {
    const withId = new Request("http://x", { headers: { "x-request-id": "rid" } });
    expect(getRequestId(withId)).toBe("rid");
    const without = new Request("http://x");
    expect(getRequestId(without)).toMatch(/[0-9a-f-]{36}/);
  });

  it("parseJsonBody validates and returns typed data", async () => {
    const schema = z.object({ email: z.string().email() });
    const ok = new Request("http://x", { method: "POST", body: JSON.stringify({ email: "a@b.com" }) });
    expect(await parseJsonBody(ok, schema)).toEqual({ email: "a@b.com" });
  });

  it("parseJsonBody throws 422 on invalid body", async () => {
    const schema = z.object({ email: z.string().email() });
    const bad = new Request("http://x", { method: "POST", body: JSON.stringify({ email: "nope" }) });
    await expect(parseJsonBody(bad, schema)).rejects.toMatchObject({ status: 422, code: "VALIDATION_FAILED" });
  });

  it("parseQuery coerces query params", () => {
    const schema = z.object({ start: z.coerce.number(), q: z.string().optional() });
    const req = new Request("http://x/api?start=5&q=hi");
    expect(parseQuery(req, schema)).toEqual({ start: 5, q: "hi" });
  });
});
