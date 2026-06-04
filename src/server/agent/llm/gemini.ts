import type { ToolRegistry } from "@server/agent/tools/registry";
import type { ToolCall } from "@server/agent/tools/types";
import type { GeminiCall } from "@server/agent/orchestrator";
import { SYSTEM_PROMPT } from "./prompt";

const MODEL = "gemini-2.0-flash";
// The API key is sent via the `x-goog-api-key` header (NOT the URL query string),
// so it never lands in access/proxy logs, error traces, or fetch error messages.
const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export interface GeminiOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export function createGeminiCall(opts: GeminiOptions): GeminiCall {
  const doFetch = opts.fetchImpl ?? fetch;
  return async ({ message, history, registry }) => {
    const contents = [
      ...history.map((h) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.text }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: [{ functionDeclarations: registry.toGeminiDeclarations() }],
    };
    const res = await doFetch(ENDPOINT(MODEL), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": opts.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Gemini request failed (${res.status})`);
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }[] } }[];
    };
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const toolCalls: ToolCall[] = [];
    let text = "";
    for (const part of parts) {
      if (part.functionCall) {
        toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} });
      } else if (part.text) {
        text += part.text;
      }
    }
    return { text: text.trim(), toolCalls };
  };
}
