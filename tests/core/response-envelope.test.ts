import { describe, it, expect } from "vitest";
import { successEnvelope, errorEnvelope } from "@server/core/response-envelope";

describe("response envelope", () => {
  it("builds a success envelope with meta + requestId", () => {
    expect(
      successEnvelope({ a: 1 }, "ok", { meta: { page: 1 }, requestId: "r1" }),
    ).toEqual({
      success: true,
      message: "ok",
      data: { a: 1 },
      meta: { page: 1 },
      requestId: "r1",
    });
  });

  it("omits meta and requestId when not provided", () => {
    expect(successEnvelope([], "ok")).toEqual({
      success: true,
      message: "ok",
      data: [],
    });
  });

  it("defaults the success message", () => {
    expect(successEnvelope(null)).toEqual({ success: true, message: "Success", data: null });
  });

  it("builds an error envelope", () => {
    expect(errorEnvelope("bad", { code: "X", details: null })).toEqual({
      success: false,
      message: "bad",
      data: { code: "X", details: null },
    });
  });

  it("includes requestId on errors when provided", () => {
    expect(errorEnvelope("bad", { code: "X" }, { requestId: "r9" })).toEqual({
      success: false,
      message: "bad",
      data: { code: "X" },
      requestId: "r9",
    });
  });
});
