import { describe, it, expect } from "vitest";
import {
  conversationMessage,
  conversationOut,
  type ConversationDoc,
} from "@server/schemas/conversation";

describe("conversation schema", () => {
  it("builds a normalized message with defaults", () => {
    const m = conversationMessage({ role: "user", text: "hi" });
    expect(m.role).toBe("user");
    expect(m.text).toBe("hi");
    expect(typeof m.id).toBe("string");
    expect(typeof m.created_at).toBe("number");
    expect(m.feedback).toBeNull();
  });

  it("conversationOut maps _id->id and strips internals", () => {
    const doc = {
      _id: "507f1f77bcf86cd799439011",
      owner_id: "owner1",
      title: "T",
      messages: [conversationMessage({ role: "assistant", text: "yo" })],
      status: "open",
      created_at: 1,
      last_updated: 2,
    } as unknown as ConversationDoc & { _id: string };
    const out = conversationOut(doc);
    expect(out.id).toBe("507f1f77bcf86cd799439011");
    expect(out).not.toHaveProperty("owner_id");
    expect(out.messages[0].text).toBe("yo");
  });
});
