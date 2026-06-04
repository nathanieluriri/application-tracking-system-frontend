import { describe, it, expect } from "vitest";
import { signConfirmToken, verifyConfirmToken } from "@server/agent/confirm/tokens";

const SECRET = "test-secret";

describe("confirm tokens", () => {
  it("round-trips a valid token", () => {
    const token = signConfirmToken(
      { tool: "positions.close", args: { id: "abc" }, userId: "u1" },
      SECRET,
      1000,
    );
    const v = verifyConfirmToken(token, SECRET, "u1");
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.tool).toBe("positions.close");
      expect(v.payload.args).toEqual({ id: "abc" });
    }
  });

  it("rejects a tampered token", () => {
    const token = signConfirmToken(
      { tool: "positions.close", args: { id: "abc" }, userId: "u1" },
      SECRET,
      1000,
    );
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa");
    expect(verifyConfirmToken(tampered, SECRET, "u1").ok).toBe(false);
  });

  it("rejects a token for a different user", () => {
    const token = signConfirmToken(
      { tool: "positions.close", args: { id: "abc" }, userId: "u1" },
      SECRET,
      1000,
    );
    expect(verifyConfirmToken(token, SECRET, "someone-else").ok).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = signConfirmToken(
      { tool: "positions.close", args: { id: "abc" }, userId: "u1" },
      SECRET,
      -1,
    );
    expect(verifyConfirmToken(token, SECRET, "u1").ok).toBe(false);
  });
});
