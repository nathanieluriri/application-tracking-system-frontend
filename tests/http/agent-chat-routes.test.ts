import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { POST as chatPOST } from "@/app/api/agent/chat/route";
import { addAdmin } from "@server/services/admins";
import { addPosition, retrievePositionById } from "@server/services/positions";
import { newId } from "../helpers/fixtures";
import { AccountStatus } from "@server/schemas/common";

const ctx = { params: Promise.resolve({}) };

async function adminCookie(): Promise<string> {
  const admin = await addAdmin({
    full_name: "Adm",
    email: `adm-${newId()}@x.com`,
    password: "pw123456",
    accountStatus: AccountStatus.ACTIVE,
    permissionList: null,
  });
  return `access_token=${admin.access_token}`;
}

function chatReq(cookie: string, payload: unknown): Request {
  return new Request("http://x/api/agent/chat", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(payload),
  });
}

describe("/api/agent/chat", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("401s an unauthenticated request", async () => {
    const res = await chatPOST(chatReq("", { message: "hi", mode: "smart" }), ctx);
    expect(res.status).toBe(401);
  });

  it("runs a read intent and returns a conversationId", async () => {
    const cookie = await adminCookie();
    await addPosition({ title: "Open one", status: "open" }, newId());
    const res = await chatPOST(chatReq(cookie, { message: "list open positions", mode: "smart" }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.conversationId).toBeTruthy();
    expect(body.data.toolResults[0].tool).toBe("positions.list");
  });

  it("returns a pending confirmation for a destructive close and executes on confirm", async () => {
    const cookie = await adminCookie();
    const role = await addPosition({ title: "Closable", status: "open" }, newId());

    const res1 = await chatPOST(
      chatReq(cookie, { message: "close the Closable position", mode: "auto_run" }),
      ctx,
    );
    const body1 = await res1.json();
    expect(body1.data.pending).toBeTruthy();
    expect((await retrievePositionById(role.id!)).status).toBe("open");

    const res2 = await chatPOST(
      chatReq(cookie, {
        conversationId: body1.data.conversationId,
        confirmToken: body1.data.pending.token,
        mode: "auto_run",
      }),
      ctx,
    );
    const body2 = await res2.json();
    expect(res2.status).toBe(200);
    expect((await retrievePositionById(role.id!)).status).toBe("closed");
    void body2;
  });
});
