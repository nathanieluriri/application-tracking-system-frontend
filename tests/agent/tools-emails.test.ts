import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb, COLLECTIONS } from "@server/core/database";
import { newId } from "../helpers/fixtures";
import { emailsTools } from "@server/agent/tools/emails";
import { retrieveEmailTemplates } from "@server/services/email-templates";

function tool(name: string) {
  const t = emailsTools.find((x) => x.name === name);
  if (!t) throw new Error(`missing ${name}`);
  return t;
}
const ctx = (userId: string) => ({ userId, req: new Request("http://x") });

describe("emails tools", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("emails.send is destructive/outbound", () => {
    const t = tool("emails.send");
    expect(t.risk).toBe("destructive");
    expect(t.permission).toBe("POST:/emails/compose");
  });

  it("emails.draft is read and persists nothing", async () => {
    const t = tool("emails.draft");
    expect(t.risk).toBe("read");
    const res = await t.execute(
      { subject: "Hi", body: "Welcome {name}", recipient_name: "Jane" } as any,
      ctx(newId()),
    );
    expect(typeof res.summary).toBe("string");
    const count = await db.collection(COLLECTIONS.outboundEmails).countDocuments({});
    expect(count).toBe(0);
  });

  it("templates.create is write and creates a template that list returns", async () => {
    const create = tool("templates.create");
    expect(create.risk).toBe("write");
    await create.execute(
      { name: "Welcome", subject: "Hi", html_body: "<p>Hello</p>" } as any,
      ctx(newId()),
    );
    const list = tool("templates.list");
    expect(list.risk).toBe("read");
    const res = await list.execute({} as any, ctx(newId()));
    expect((res.data as unknown[]).length).toBe(1);
    // sanity via service too
    expect((await retrieveEmailTemplates()).length).toBe(1);
  });
});
