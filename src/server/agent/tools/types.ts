import { z } from "zod";

/** Risk tiers govern auto-run vs. confirmation in the orchestrator. */
export type Risk = "read" | "write" | "destructive";

/** Per-turn context passed to a tool's execute(). */
export interface ToolContext {
  /** Authenticated actor id (admin.id). */
  userId: string;
  /** The original Request — tools that wrap permissioned services may need it. */
  req: Request;
}

/** A concrete tool invocation (name + raw args before validation). */
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolExecResult {
  /** Short human summary, also stored on the message for audit. */
  summary: string;
  /** Structured payload (e.g. created entity) for narration/UI. */
  data?: unknown;
}

/**
 * A tool wraps exactly one service capability. `schema` validates args;
 * `permission` is the existing backend permission key enforced before run;
 * `preview` renders a confirm-card description for write/destructive tools.
 */
export interface ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  risk: Risk;
  permission: string;
  schema: S;
  preview: (args: z.infer<S>) => string;
  execute: (args: z.infer<S>, ctx: ToolContext) => Promise<ToolExecResult>;
}
