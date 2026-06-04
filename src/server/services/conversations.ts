import { notFound } from "@server/core/errors";
import {
  insertConversation,
  findConversation,
  pushMessages,
  listConversations,
  renameConversation,
  setMessageFeedback,
  deleteConversation,
} from "@server/repositories/conversations";
import {
  conversationDoc,
  conversationMessage,
  type ConversationMessage,
  type ConversationOut,
  type ConversationSummaryOut,
} from "@server/schemas/conversation";

/** Business logic for AI-assistant conversations. All ops are owner-scoped. */

function deriveTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 60) return trimmed || "New conversation";
  return `${trimmed.slice(0, 57)}...`;
}

export async function startConversation(
  ownerId: string,
  firstUserMessage: string,
): Promise<ConversationOut> {
  return insertConversation(conversationDoc(ownerId, deriveTitle(firstUserMessage)));
}

export async function appendTurn(
  id: string,
  ownerId: string,
  messages: ConversationMessage[],
): Promise<ConversationOut> {
  const updated = await pushMessages(id, ownerId, messages);
  if (!updated) throw notFound("Conversation not found");
  return updated;
}

export async function listForOwner(
  ownerId: string,
  start = 0,
  stop = 50,
): Promise<ConversationSummaryOut[]> {
  return listConversations(ownerId, start, stop);
}

export async function getForOwner(id: string, ownerId: string): Promise<ConversationOut> {
  const found = await findConversation(id, ownerId);
  if (!found) throw notFound("Conversation not found");
  return found;
}

export async function renameForOwner(
  id: string,
  ownerId: string,
  title: string,
): Promise<ConversationOut> {
  const updated = await renameConversation(id, ownerId, title.trim() || "Untitled");
  if (!updated) throw notFound("Conversation not found");
  return updated;
}

export async function setFeedbackForOwner(
  id: string,
  ownerId: string,
  messageId: string,
  feedback: "up" | "down" | null,
): Promise<ConversationOut> {
  const updated = await setMessageFeedback(id, ownerId, messageId, feedback);
  if (!updated) throw notFound("Conversation or message not found");
  return updated;
}

export async function deleteForOwner(
  id: string,
  ownerId: string,
): Promise<{ deleted: boolean }> {
  const res = await deleteConversation(id, ownerId);
  if (res.deletedCount === 0) throw notFound("Conversation not found");
  return { deleted: true };
}

// Re-export the message builder so the orchestrator/route share one source.
export { conversationMessage };
