import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { newId } from "../helpers/fixtures";
import { positionsTools } from "@server/agent/tools/positions";
import { addPosition, retrievePositionById } from "@server/services/positions";

function tool(name: string) {
  const t = positionsTools.find((x) => x.name === name);
  if (!t) throw new Error(`missing tool ${name}`);
  return t;
}
const ctx = (userId: string) => ({ userId, req: new Request("http://x") });

describe("positions tools", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("positions.create makes a draft and is risk=write", async () => {
    const t = tool("positions.create");
    expect(t.risk).toBe("write");
    expect(t.permission).toBe("POST:/positions");
    const res = await t.execute(
      { title: "Senior Backend Engineer", department: "Platform", description: "x" } as any,
      ctx(newId()),
    );
    const created = (res.data as { id: string });
    const stored = await retrievePositionById(created.id);
    expect(stored.title).toBe("Senior Backend Engineer");
    expect(stored.status).toBe("draft");
  });

  it("positions.close is destructive and closes the role", async () => {
    const t = tool("positions.close");
    expect(t.risk).toBe("destructive");
    const p = await addPosition({ title: "Old", status: "open" }, newId());
    await t.execute({ id: p.id! } as any, ctx(newId()));
    expect((await retrievePositionById(p.id!)).status).toBe("closed");
  });

  it("positions.list is read and returns items", async () => {
    const t = tool("positions.list");
    expect(t.risk).toBe("read");
    await addPosition({ title: "A", status: "open" }, newId());
    const res = await t.execute({} as any, ctx(newId()));
    expect(Array.isArray(res.data)).toBe(true);
    expect((res.data as unknown[]).length).toBe(1);
  });
});
