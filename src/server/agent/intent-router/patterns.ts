import { bestMatch, type Labeled } from "./fuzzy";
import type { ToolCall } from "@server/agent/tools/types";

export interface RouterDataContext {
  positions: Labeled[];
  applicants: Labeled[];
  stages: Labeled[];
}

export interface IntentMatch {
  toolCall: ToolCall;
  confidence: number;
}

export interface IntentPattern {
  id: string;
  match: (message: string, ctx: RouterDataContext) => IntentMatch | null;
}

const lower = (s: string) => s.toLowerCase().trim();

export const patterns: IntentPattern[] = [
  {
    id: "positions.list",
    match: (msg) => {
      const m = lower(msg);
      if (/\b(list|show|view)\b.*\b(positions?|jobs?|postings?)\b/.test(m)) {
        const status = /\bopen\b/.test(m)
          ? "open"
          : /\bclosed\b/.test(m)
            ? "closed"
            : /\bdraft\b/.test(m)
              ? "draft"
              : undefined;
        return {
          toolCall: { name: "positions.list", args: status ? { status } : {} },
          confidence: 0.9,
        };
      }
      return null;
    },
  },
  {
    id: "positions.close",
    match: (msg, ctx) => {
      const m = lower(msg);
      if (/\bclose\b.*\b(position|role|posting|job)\b/.test(m)) {
        const phrase = m
          .replace(/.*\bclose\b\s*(the)?\s*/, "")
          .replace(/\b(position|role|posting|job)\b.*/, "")
          .trim();
        const hit = bestMatch(phrase, ctx.positions);
        if (hit) {
          return { toolCall: { name: "positions.close", args: { id: hit.id } }, confidence: 0.85 };
        }
      }
      return null;
    },
  },
  {
    id: "applicants.search",
    match: (msg, ctx) => {
      const m = lower(msg);
      if (/\b(show|list|view|find)\b.*\bapplicants?\b/.test(m)) {
        const args: Record<string, unknown> = {};
        const forMatch = m.match(/\bfor\s+(.+?)(?:\s+in\b|$)/);
        if (forMatch) {
          const pos = bestMatch(forMatch[1], ctx.positions);
          if (pos) args.position_id = pos.id;
        }
        const inMatch = m.match(/\bin\s+(.+)$/);
        if (inMatch) {
          const stage = bestMatch(inMatch[1], ctx.stages);
          if (stage) args.status = stage.id;
        }
        return { toolCall: { name: "applicants.search", args }, confidence: 0.8 };
      }
      return null;
    },
  },
  {
    id: "applicants.move",
    match: (msg, ctx) => {
      const m = lower(msg);
      const mv = m.match(/\bmove\s+(.+?)\s+to\s+(.+)$/);
      if (mv) {
        const person = bestMatch(mv[1], ctx.applicants);
        const stage = bestMatch(mv[2], ctx.stages);
        if (person && stage) {
          return {
            toolCall: { name: "applicants.move", args: { id: person.id, status: stage.id } },
            confidence: 0.85,
          };
        }
      }
      return null;
    },
  },
];
