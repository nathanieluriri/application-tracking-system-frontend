import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import {
  startConversation,
  appendTurn,
  listForOwner,
  getForOwner,
  renameForOwner,
  setFeedbackForOwner,
  deleteForOwner,
} from "@server/services/conversations";
import { conversationMessage } from "@server/schemas/conversation";

describe("conversations service", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("derives a title from the first user message (truncated)", async () => {
    const c = await startConversation(
      "owner1",
      "Please create a detailed senior backend engineer posting for the platform team",
    );
    expect(c.title.length).toBeLessThanOrEqual(60);
    expect(c.title.startsWith("Please create")).toBe(true);
  });

  it("appends a turn and returns the updated conversation", async () => {
    const c = await startConversation("owner1", "hi");
    const updated = await appendTurn(c.id!, "owner1", [
      conversationMessage({ role: "user", text: "hi" }),
      conversationMessage({ role: "assistant", text: "hello" }),
    ]);
    expect(updated.messages).toHaveLength(2);
  });

  it("getForOwner of another owner's conversation throws 404", async () => {
    const c = await startConversation("owner1", "secret");
    await expect(getForOwner(c.id!, "owner2")).rejects.toMatchObject({ status: 404 });
  });

  it("rename/feedback/delete are owner-scoped", async () => {
    const c = await startConversation("owner1", "x");
    const withMsg = await appendTurn(c.id!, "owner1", [
      conversationMessage({ role: "assistant", text: "a" }),
    ]);
    const mid = withMsg.messages[0].id;
    await renameForOwner(c.id!, "owner1", "Renamed");
    expect((await getForOwner(c.id!, "owner1")).title).toBe("Renamed");
    await setFeedbackForOwner(c.id!, "owner1", mid, "down");
    expect((await getForOwner(c.id!, "owner1")).messages[0].feedback).toBe("down");
    await expect(deleteForOwner(c.id!, "owner2")).rejects.toMatchObject({ status: 404 });
    await expect(deleteForOwner(c.id!, "owner1")).resolves.toEqual({ deleted: true });
  });
});
