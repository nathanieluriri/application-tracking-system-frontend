import { describe, it, expect, vi } from "vitest";
import { createGeminiCall } from "@server/agent/llm/gemini";
import { buildRegistry } from "@server/agent/tools";

describe("gemini call", () => {
  it("parses a functionCall response into toolCalls", async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { functionCall: { name: "positions.list", args: { status: "open" } } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const call = createGeminiCall({ apiKey: "k", fetchImpl: fakeFetch as unknown as typeof fetch });
    const out = await call({ message: "show open roles", history: [], registry: buildRegistry() });
    expect(out.toolCalls[0].name).toBe("positions.list");
    expect(out.toolCalls[0].args).toEqual({ status: "open" });
  });

  it("parses a plain-text response", async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Here's what I found." }] } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const call = createGeminiCall({ apiKey: "k", fetchImpl: fakeFetch as unknown as typeof fetch });
    const out = await call({ message: "hi", history: [], registry: buildRegistry() });
    expect(out.text).toBe("Here's what I found.");
    expect(out.toolCalls).toHaveLength(0);
  });

  it("throws a friendly error on non-200", async () => {
    const fakeFetch = vi.fn(async () => new Response("nope", { status: 429 }));
    const call = createGeminiCall({ apiKey: "k", fetchImpl: fakeFetch as unknown as typeof fetch });
    await expect(
      call({ message: "x", history: [], registry: buildRegistry() }),
    ).rejects.toThrow(/Gemini/);
  });
});
