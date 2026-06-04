"use client";

import { apiFetch } from "@/lib/api/client";
import type {
  AutonomyMode,
  ChatResponse,
  Conversation,
  ConversationSummary,
} from "./types";

export interface ChatArgs {
  message?: string;
  conversationId?: string;
  confirmToken?: string;
  mode: AutonomyMode;
}

export function chat(args: ChatArgs): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/api/agent/chat", { method: "POST", body: args });
}

export function listConversations(start = 0, stop = 50): Promise<ConversationSummary[]> {
  const qs = `?start=${start}&stop=${stop}`;
  return apiFetch<ConversationSummary[]>(`/api/agent/conversations${qs}`, { method: "GET" });
}

export function getConversation(id: string): Promise<Conversation> {
  return apiFetch<Conversation>(`/api/agent/conversations/${id}`, { method: "GET" });
}

export function renameConversation(id: string, title: string): Promise<Conversation> {
  return apiFetch<Conversation>(`/api/agent/conversations/${id}`, {
    method: "PATCH",
    body: { title },
  });
}

export function setFeedback(
  id: string,
  messageId: string,
  feedback: "up" | "down" | null,
): Promise<Conversation> {
  return apiFetch<Conversation>(`/api/agent/conversations/${id}`, {
    method: "PATCH",
    body: { messageId, feedback },
  });
}

export function deleteConversation(id: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/api/agent/conversations/${id}`, { method: "DELETE" });
}
