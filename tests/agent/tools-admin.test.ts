import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { newId } from "../helpers/fixtures";
import { adminTools } from "@server/agent/tools/admin";
import { retrieveWidgets } from "@server/services/widgets";

function tool(name: string) {
  const t = adminTools.find((x) => x.name === name);
  if (!t) throw new Error(`missing ${name}`);
  return t;
}
const ctx = (userId: string) => ({ userId, req: new Request("http://x") });

describe("admin tools", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("risk levels are correct", () => {
    expect(tool("widgets.create").risk).toBe("write");
    expect(tool("widgets.duplicate").risk).toBe("write");
    expect(tool("widgets.list").risk).toBe("read");
    expect(tool("invitations.create").risk).toBe("destructive"); // sends an invite email
    expect(tool("invitations.revoke").risk).toBe("destructive");
    expect(tool("invitations.list").risk).toBe("read");
    expect(tool("settings.get").risk).toBe("read");
    expect(tool("settings.update").risk).toBe("write");
  });

  it("permission keys are correct", () => {
    expect(tool("widgets.create").permission).toBe("POST:/widgets");
    expect(tool("invitations.create").permission).toBe("POST:/invitations");
    expect(tool("invitations.revoke").permission).toBe("POST:/invitations/{invitation_id}/revoke");
    expect(tool("settings.update").permission).toBe("PUT:/settings");
  });

  it("widgets.create then widgets.list reflects the new widget", async () => {
    await tool("widgets.create").execute({ name: "Careers Embed" } as any, ctx(newId()));
    const res = await tool("widgets.list").execute({} as any, ctx(newId()));
    expect((res.data as unknown[]).length).toBe(1);
    expect((await retrieveWidgets()).length).toBe(1);
  });
});
