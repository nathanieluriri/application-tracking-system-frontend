import { describe, it, expect } from "vitest";
import { bestMatch } from "@server/agent/intent-router/fuzzy";

const items = [
  { id: "1", label: "Senior Backend Engineer" },
  { id: "2", label: "Frontend Developer" },
  { id: "3", label: "Product Manager" },
];

describe("bestMatch", () => {
  it("resolves a close phrase to the right item", () => {
    const m = bestMatch("backend engineer", items);
    expect(m?.id).toBe("1");
  });
  it("returns null when nothing is close enough", () => {
    expect(bestMatch("astronaut", items)).toBeNull();
  });
});
