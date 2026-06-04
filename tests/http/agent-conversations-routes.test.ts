import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { GET as listGET } from "@/app/api/agent/conversations/route";
import {
  GET as oneGET,
  PATCH as onePATCH,
  DELETE as oneDELETE,
} from "@/app/api/agent/conversations/[id]/route";
import { addAdmin } from "@server/services/admins";
import { startConversation, appendTurn } from "@server/services/conversations";
import { conversationMessage } from "@server/schemas/conversation";
import { newId } from "../helpers/fixtures";
import { AccountStatus } from "@server/schemas/common";

async function admin(): Promise<{ cookie: string; id: string }> {
  const a = await addAdmin({
    full_name: "Adm",
    email: `adm-${newId()}@x.com`,
    password: "pw123456",
    accountStatus: AccountStatus.ACTIVE,
    permissionList: null,
  });
  return { cookie: `access_token=${a.access_token}`, id: a.id! };
}

describe("/api/agent/conversations", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("lists only the caller's conversations", async () => {
    const a = await admin();
    await startConversation(a.id, "Mine");
    await startConversation(newId(), "Theirs");
    const res = await listGET(
      new Request("http://x/api/agent/conversations", { headers: { cookie: a.cookie } }),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Mine");
  });

  it("gets, renames, and deletes a conversation (owner-scoped)", async () => {
    const a = await admin();
    const c = await startConversation(a.id, "Old");
    await appendTurn(c.id!, a.id, [conversationMessage({ role: "assistant", text: "x" })]);

    const idCtx = { params: Promise.resolve({ id: c.id! }) };

    const got = await oneGET(
      new Request(`http://x/api/agent/conversations/${c.id}`, { headers: { cookie: a.cookie } }),
      idCtx,
    );
    expect((await got.json()).data.title).toBe("Old");

    const renamed = await onePATCH(
      new Request(`http://x/api/agent/conversations/${c.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: a.cookie },
        body: JSON.stringify({ title: "New" }),
      }),
      idCtx,
    );
    expect((await renamed.json()).data.title).toBe("New");

    const del = await oneDELETE(
      new Request(`http://x/api/agent/conversations/${c.id}`, {
        method: "DELETE",
        headers: { cookie: a.cookie },
      }),
      idCtx,
    );
    expect(del.status).toBe(200);
  });

  it("404s when accessing another owner's conversation", async () => {
    const a = await admin();
    const otherId = (await startConversation(newId(), "Secret")).id!;
    const res = await oneGET(
      new Request(`http://x/api/agent/conversations/${otherId}`, { headers: { cookie: a.cookie } }),
      { params: Promise.resolve({ id: otherId }) },
    );
    expect(res.status).toBe(404);
  });
});
