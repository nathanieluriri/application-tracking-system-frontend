export type AutonomyMode = "confirm_everything" | "smart" | "auto_run";

export interface Step {
  label: string;
  status: "pending" | "active" | "done";
}

export interface ToolResultSummary {
  tool: string;
  status: "ok" | "error" | "pending";
  summary: string;
}

export interface PendingConfirmation {
  token: string;
  toolName: string;
  preview: string;
}

export interface ChatResponse {
  conversationId: string;
  text: string;
  steps: Step[];
  toolResults: ToolResultSummary[];
  suggestions: string[];
  pending?: PendingConfirmation;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: string[];
  tool_results?: ToolResultSummary[];
  suggestions?: string[];
  feedback: "up" | "down" | null;
  created_at: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  status: string;
  message_count: number;
  last_updated: number | null;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  status: string;
  created_at: number | null;
  last_updated: number | null;
}
