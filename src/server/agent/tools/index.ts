import { ToolRegistry } from "./registry";
import { positionsTools } from "./positions";
import { applicantsTools } from "./applicants";
import { emailsTools } from "./emails";
import { adminTools } from "./admin";

/** Build a fresh registry with all tool verticals registered. */
export function buildRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  for (const tool of [...positionsTools, ...applicantsTools, ...emailsTools, ...adminTools]) r.register(tool);
  return r;
}

/** Shared singleton for the runtime (tests build their own). */
let cached: ToolRegistry | null = null;
export function getRegistry(): ToolRegistry {
  if (!cached) cached = buildRegistry();
  return cached;
}
