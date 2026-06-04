import { nowSeconds } from "./common";

/** Conversation persistence schema for the AI assistant. */

export const messageRoleValues = ["user", "assistant"] as const;
export const conversationStatusValues = ["open", "closed"] as const;

export interface ToolResultSummary {
  tool: string;
  status: "ok" | "error" | "pending";
  summary: string;
}

export interface ConversationMessage {
  id: string;
  role: (typeof messageRoleValues)[number];
  text: string;
  steps?: string[];
  tool_results?: ToolResultSummary[];
  suggestions?: string[];
  feedback: "up" | "down" | null;
  created_at: number;
}

export interface ConversationDoc {
  owner_id: string;
  title: string;
  messages: ConversationMessage[];
  status: (typeof conversationStatusValues)[number];
  created_at: number;
  last_updated: number;
}

export interface ConversationSummaryOut {
  id: string | null;
  title: string;
  status: string;
  message_count: number;
  last_updated: number | null;
}

export interface ConversationOut {
  id: string | null;
  title: string;
  messages: ConversationMessage[];
  status: string;
  created_at: number | null;
  last_updated: number | null;
}

let messageCounter = 0;
/** Deterministic-enough unique id without Date.now()/random in hot path. */
function messageId(): string {
  messageCounter += 1;
  return `m_${nowSeconds()}_${messageCounter}`;
}

export function conversationMessage(input: {
  role: (typeof messageRoleValues)[number];
  text: string;
  steps?: string[];
  tool_results?: ToolResultSummary[];
  suggestions?: string[];
}): ConversationMessage {
  return {
    id: messageId(),
    role: input.role,
    text: input.text,
    steps: input.steps,
    tool_results: input.tool_results,
    suggestions: input.suggestions,
    feedback: null,
    created_at: nowSeconds(),
  };
}

export function conversationDoc(ownerId: string, title: string): ConversationDoc {
  return {
    owner_id: ownerId,
    title,
    messages: [],
    status: "open",
    created_at: nowSeconds(),
    last_updated: nowSeconds(),
  };
}

export function conversationOut(doc: Record<string, any>): ConversationOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    title: doc.title,
    messages: doc.messages ?? [],
    status: doc.status ?? "open",
    created_at: doc.created_at ?? null,
    last_updated: doc.last_updated ?? null,
  };
}

export function conversationSummaryOut(doc: Record<string, any>): ConversationSummaryOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    title: doc.title,
    status: doc.status ?? "open",
    message_count: Array.isArray(doc.messages) ? doc.messages.length : (doc.message_count ?? 0),
    last_updated: doc.last_updated ?? null,
  };
}
