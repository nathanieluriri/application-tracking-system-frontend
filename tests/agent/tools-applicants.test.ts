import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { newId } from "../helpers/fixtures";
import { applicantsTools } from "@server/agent/tools/applicants";
import { addPosition } from "@server/services/positions";
import { submitApplication, retrieveApplication } from "@server/services/applications";
import { addApplicationProcess } from "@server/services/application-process";

function tool(name: string) {
  const t = applicantsTools.find((x) => x.name === name);
  if (!t) throw new Error(`missing ${name}`);
  return t;
}
const ctx = (userId: string) => ({ userId, req: new Request("http://x") });

/** Helper: open position with no-CV process containing interview stage */
async function openPositionWithProcess(): Promise<{ id: string }> {
  const proc = await addApplicationProcess({
    name: "TestProcess",
    stages: [
      { key: "new", label: "New", order: 1 },
      { key: "interview", label: "Interview", order: 2 },
    ],
    require_cv: false,
    auto_acknowledge: false,
  });
  const pos = await addPosition({ title: "Eng", status: "open", process_template_id: proc.id! }, newId());
  return { id: pos.id! };
}

describe("applicants tools", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("applicants.search is read and finds by name", async () => {
    const t = tool("applicants.search");
    expect(t.risk).toBe("read");
    expect(t.permission).toBe("GET:/applications");
    const pos = await openPositionWithProcess();
    await submitApplication({ full_name: "Jane Doe", email: "j@x.com", position_id: pos.id! });
    const res = await t.execute({ search: "Jane" } as any, ctx(newId()));
    expect((res.data as unknown[]).length).toBe(1);
  });

  it("applicants.move is write and changes status", async () => {
    const t = tool("applicants.move");
    expect(t.risk).toBe("write");
    expect(t.permission).toBe("PATCH:/applications/{application_id}");
    const pos = await openPositionWithProcess();
    const app = await submitApplication({ full_name: "Bob", email: "b@x.com", position_id: pos.id! });
    await t.execute({ id: app.id!, status: "interview" } as any, ctx(newId()));
    expect((await retrieveApplication(app.id!)).status).toBe("interview");
  });

  it("applicants.note is write and stores a note", async () => {
    const t = tool("applicants.note");
    expect(t.risk).toBe("write");
    const pos = await openPositionWithProcess();
    const app = await submitApplication({ full_name: "Cara", email: "c@x.com", position_id: pos.id! });
    await t.execute({ id: app.id!, note: "Strong candidate" } as any, ctx(newId()));
    expect((await retrieveApplication(app.id!)).notes).toBe("Strong candidate");
  });
});
