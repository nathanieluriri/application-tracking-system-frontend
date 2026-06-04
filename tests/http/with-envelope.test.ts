import { describe, it, expect } from "vitest";
import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { AppError, ErrorCode } from "@server/core/errors";

const ctx = { params: Promise.resolve({}) };

describe("withEnvelope", () => {
  it("wraps a success result in the envelope", async () => {
    const handler = withEnvelope(async () => ({ a: 1 }), { message: "ok", status: 200 });
    const res = await handler(new Request("http://x"), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
    expect(await res.json()).toMatchObject({ success: true, message: "ok", data: { a: 1 } });
  });

  it("passes a custom status through", async () => {
    const handler = withEnvelope(async () => ({ created: true }), { message: "made", status: 201 });
    const res = await handler(new Request("http://x"), ctx);
    expect(res.status).toBe(201);
  });

  it("maps an AppError to the error envelope", async () => {
    const handler = withEnvelope(async () => {
      throw new AppError({ status: 404, code: ErrorCode.RESOURCE_NOT_FOUND, message: "nf" });
    });
    const res = await handler(new Request("http://x"), ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      success: false,
      message: "nf",
      data: { code: "RESOURCE_NOT_FOUND" },
    });
  });

  it("maps a ZodError to 422 VALIDATION_FAILED", async () => {
    const handler = withEnvelope(async () => {
      z.object({ x: z.number() }).parse({ x: "no" });
    });
    const res = await handler(new Request("http://x"), ctx);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ success: false, data: { code: "VALIDATION_FAILED" } });
  });

  it("maps an unknown error to 500 INTERNAL_ERROR", async () => {
    const handler = withEnvelope(async () => {
      throw new Error("boom");
    });
    const res = await handler(new Request("http://x"), ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ success: false, data: { code: "INTERNAL_ERROR" } });
  });

  it("passes a NextResponse result straight through (cookie-setting handlers)", async () => {
    const { NextResponse } = await import("next/server");
    const handler = withEnvelope(async () => NextResponse.json({ custom: true }, { status: 207 }));
    const res = await handler(new Request("http://x"), ctx);
    expect(res.status).toBe(207);
    expect(await res.json()).toEqual({ custom: true });
  });
});
