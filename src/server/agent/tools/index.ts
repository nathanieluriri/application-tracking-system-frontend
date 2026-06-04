import { ToolRegistry } from "./registry";
import { positionsTools } from "./positions";

/** Build a fresh registry with all tool verticals registered. */
export function buildRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  for (const tool of [...positionsTools]) r.register(tool);
  return r;
}

/** Shared singleton for the runtime (tests build their own). */
let cached: ToolRegistry | null = null;
export function getRegistry(): ToolRegistry {
  if (!cached) cached = buildRegistry();
  return cached;
}
