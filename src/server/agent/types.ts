import type { ToolResultSummary } from "@server/schemas/conversation";

export type AutonomyMode = "confirm_everything" | "smart" | "auto_run";

export interface Step {
  label: string;
  status: "pending" | "active" | "done";
}

export interface PendingConfirmation {
  /** HMAC token binding {tool,args,userId}; echoed back to execute. */
  token: string;
  toolName: string;
  /** Human preview of what will happen. */
  preview: string;
}

export interface ChatTurnInput {
  message?: string;
  conversationId?: string;
  mode: AutonomyMode;
  /** Present on a confirm round-trip instead of `message`. */
  confirmToken?: string;
}

export interface ChatTurnOutput {
  conversationId: string;
  text: string;
  steps: Step[];
  toolResults: ToolResultSummary[];
  suggestions: string[];
  pending?: PendingConfirmation;
}
