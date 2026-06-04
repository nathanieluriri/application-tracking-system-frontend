import { describe, it, expect } from "vitest";
import { matchIntent } from "@server/agent/intent-router/index";

const dataCtx = {
  positions: [
    { id: "p1", label: "Senior Backend Engineer" },
    { id: "p2", label: "Frontend Developer" },
  ],
  applicants: [{ id: "a1", label: "Jane Doe" }],
  stages: [
    { id: "interview", label: "Interview" },
    { id: "new", label: "New" },
  ],
};

describe("matchIntent", () => {
  it("matches 'list open positions'", () => {
    const m = matchIntent("list open positions", dataCtx);
    expect(m?.toolCall.name).toBe("positions.list");
    expect(m?.toolCall.args).toMatchObject({ status: "open" });
  });

  it("matches 'close the Frontend Developer position' to the right id", () => {
    const m = matchIntent("close the Frontend Developer position", dataCtx);
    expect(m?.toolCall.name).toBe("positions.close");
    expect(m?.toolCall.args).toMatchObject({ id: "p2" });
  });

  it("matches 'move Jane to interview'", () => {
    const m = matchIntent("move Jane to interview", dataCtx);
    expect(m?.toolCall.name).toBe("applicants.move");
    expect(m?.toolCall.args).toMatchObject({ id: "a1", status: "interview" });
  });

  it("returns null for an ambiguous/unknown request (LLM fallback)", () => {
    expect(
      matchIntent("write a clever poem about our hiring funnel", dataCtx),
    ).toBeNull();
  });
});
