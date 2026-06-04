import { describe, it, expect, vi, beforeEach } from "vitest";

const apiFetchMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { chat, listConversations, renameConversation, setFeedback, deleteConversation } from "@/lib/agent/client";

describe("agent client", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("chat() posts to /api/agent/chat and returns data", async () => {
    apiFetchMock.mockResolvedValue({
      conversationId: "c1", text: "hi", steps: [], toolResults: [], suggestions: [],
    });
    const res = await chat({ message: "list positions", mode: "smart" });
    expect(res.conversationId).toBe("c1");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/agent/chat", expect.objectContaining({
      method: "POST",
      body: expect.objectContaining({ message: "list positions", mode: "smart" }),
    }));
  });

  it("listConversations() GETs the list endpoint", async () => {
    apiFetchMock.mockResolvedValue([{ id: "c1", title: "T", status: "open", message_count: 2, last_updated: 1 }]);
    const res = await listConversations();
    expect(res).toHaveLength(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/agent/conversations"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("renameConversation() PATCHes with a title", async () => {
    apiFetchMock.mockResolvedValue({ id: "c1", title: "New", messages: [], status: "open", created_at: 1, last_updated: 2 });
    await renameConversation("c1", "New");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/agent/conversations/c1", expect.objectContaining({
      method: "PATCH", body: { title: "New" },
    }));
  });

  it("setFeedback() PATCHes with messageId + feedback", async () => {
    apiFetchMock.mockResolvedValue({ id: "c1", title: "T", messages: [], status: "open", created_at: 1, last_updated: 2 });
    await setFeedback("c1", "m1", "up");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/agent/conversations/c1", expect.objectContaining({
      method: "PATCH", body: { messageId: "m1", feedback: "up" },
    }));
  });

  it("deleteConversation() DELETEs", async () => {
    apiFetchMock.mockResolvedValue({ deleted: true });
    await deleteConversation("c1");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/agent/conversations/c1", expect.objectContaining({ method: "DELETE" }));
  });
});
