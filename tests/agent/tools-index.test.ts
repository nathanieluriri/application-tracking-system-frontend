import { describe, it, expect } from "vitest";
import { buildRegistry } from "@server/agent/tools";

describe("buildRegistry", () => {
  it("registers the positions tools", () => {
    const r = buildRegistry();
    expect(r.get("positions.create")).toBeDefined();
    expect(r.get("positions.close")?.risk).toBe("destructive");
    expect(r.toGeminiDeclarations().some((d) => d.name === "positions.create")).toBe(true);
    expect(r.get("applicants.move")?.risk).toBe("write");
    expect(r.get("emails.send")?.risk).toBe("destructive");
  });
});
