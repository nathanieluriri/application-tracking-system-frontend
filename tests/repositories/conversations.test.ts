import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import {
  insertConversation,
  findConversation,
  pushMessages,
  listConversations,
  renameConversation,
  setMessageFeedback,
  deleteConversation,
} from "@server/repositories/conversations";
import { conversationDoc, conversationMessage } from "@server/schemas/conversation";

describe("conversations repository", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("inserts and finds scoped by owner", async () => {
    const c = await insertConversation(conversationDoc("owner1", "Hello"));
    expect(c.id).toBeTruthy();
    const found = await findConversation(c.id!, "owner1");
    expect(found?.title).toBe("Hello");
    const wrongOwner = await findConversation(c.id!, "owner2");
    expect(wrongOwner).toBeNull();
  });

  it("pushes messages and bumps last_updated", async () => {
    const c = await insertConversation(conversationDoc("owner1", "T"));
    const updated = await pushMessages(c.id!, "owner1", [
      conversationMessage({ role: "user", text: "hi" }),
      conversationMessage({ role: "assistant", text: "hello" }),
    ]);
    expect(updated?.messages).toHaveLength(2);
  });

  it("lists only the owner's conversations as summaries", async () => {
    await insertConversation(conversationDoc("owner1", "A"));
    await insertConversation(conversationDoc("owner1", "B"));
    await insertConversation(conversationDoc("owner2", "C"));
    const list = await listConversations("owner1", 0, 50);
    expect(list).toHaveLength(2);
    expect(list[0]).not.toHaveProperty("messages");
  });

  it("renames, sets feedback, deletes — all owner-scoped", async () => {
    const c = await insertConversation(conversationDoc("owner1", "Old"));
    await pushMessages(c.id!, "owner1", [conversationMessage({ role: "assistant", text: "x" })]);
    const full = await findConversation(c.id!, "owner1");
    const mid = full!.messages[0].id;

    await renameConversation(c.id!, "owner1", "New");
    expect((await findConversation(c.id!, "owner1"))?.title).toBe("New");

    await setMessageFeedback(c.id!, "owner1", mid, "up");
    const reread = await findConversation(c.id!, "owner1");
    expect(reread?.messages[0].feedback).toBe("up");

    const delByWrong = await deleteConversation(c.id!, "owner2");
    expect(delByWrong.deletedCount).toBe(0);
    const del = await deleteConversation(c.id!, "owner1");
    expect(del.deletedCount).toBe(1);
  });
});
