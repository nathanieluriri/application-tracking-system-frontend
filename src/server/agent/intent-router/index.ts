import { patterns, type RouterDataContext, type IntentMatch } from "./patterns";

export const ROUTER_CONFIDENCE_THRESHOLD = 0.75;

/** Run the deterministic patterns; return the first confident match or null. */
export function matchIntent(
  message: string,
  ctx: RouterDataContext,
): IntentMatch | null {
  for (const p of patterns) {
    const hit = p.match(message, ctx);
    if (hit && hit.confidence >= ROUTER_CONFIDENCE_THRESHOLD) return hit;
  }
  return null;
}

export type { RouterDataContext } from "./patterns";
