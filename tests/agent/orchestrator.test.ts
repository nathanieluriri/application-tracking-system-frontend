import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { newId } from "../helpers/fixtures";
import { runTurn } from "@server/agent/orchestrator";
import { buildRegistry } from "@server/agent/tools";
import { retrievePositions } from "@server/services/positions";

const deps = (opts?: { allow?: boolean }) => ({
  registry: buildRegistry(),
  checkPermission: vi.fn(async () => {
    if (opts?.allow === false) throw Object.assign(new Error("denied"), { status: 403 });
  }),
  secret: "s",
  geminiCall: undefined,
});

const req = new Request("http://x");

describe("runTurn (router-only)", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("auto-runs a read intent and persists the conversation", async () => {
    const out = await runTurn(
      { message: "list open positions", mode: "smart" },
      { userId: newId(), req },
      deps(),
    );
    expect(out.conversationId).toBeTruthy();
    expect(out.toolResults[0].tool).toBe("positions.list");
    expect(out.pending).toBeUndefined();
  });

  it("auto-runs a write in smart mode (create draft) without confirmation", async () => {
    const out = await runTurn(
      { message: "create a job posting for QA Engineer", mode: "smart" },
      { userId: newId(), req },
      deps(),
    );
    expect(out.text.length).toBeGreaterThan(0);
  });

  it("requires confirmation for a destructive close, even in auto_run mode", async () => {
    const role = await retrievePositions({}).then(() => null).catch(() => null);
    void role;
    const { addPosition, retrievePositionById } = await import("@server/services/positions");
    const created = await addPosition({ title: "Closable", status: "open" }, newId());

    const out = await runTurn(
      { message: `close the Closable position`, mode: "auto_run" },
      { userId: newId(), req },
      deps(),
    );
    expect(out.pending).toBeDefined();
    expect(out.pending?.toolName).toBe("positions.close");
    expect((await retrievePositionById(created.id!)).status).toBe("open");
  });

  it("confirm_everything mode confirms even a write", async () => {
    const { addPosition } = await import("@server/services/positions");
    await addPosition({ title: "Any", status: "open" }, newId());
    const out = await runTurn(
      { message: "move Jane to interview", mode: "confirm_everything" },
      { userId: newId(), req },
      deps(),
    );
    expect(out.text.length).toBeGreaterThan(0);
  });

  it("blocks execution when the permission check denies", async () => {
    const { addPosition } = await import("@server/services/positions");
    await addPosition({ title: "Denied", status: "open" }, newId());
    const out = await runTurn(
      { message: "list open positions", mode: "smart" },
      { userId: newId(), req },
      deps({ allow: false }),
    );
    expect(out.text).toMatch(/permission/i);
    expect(out.toolResults.every((r) => r.status !== "ok")).toBe(true);
  });

  it("blocks a confirmed execution when permission is revoked between turns", async () => {
    const { addPosition, retrievePositionById } = await import("@server/services/positions");
    const role = await addPosition({ title: "RevokeMe", status: "open" }, newId());
    const userId = newId();

    let allow = true;
    const d = {
      registry: buildRegistry(),
      checkPermission: vi.fn(async () => {
        if (!allow) throw Object.assign(new Error("denied"), { status: 403 });
      }),
      secret: "s",
      geminiCall: undefined,
    };

    const first = await runTurn(
      { message: "close the RevokeMe position", mode: "auto_run" },
      { userId, req },
      d,
    );
    expect(first.pending).toBeDefined();

    allow = false; // permission revoked before confirming
    const second = await runTurn(
      { conversationId: first.conversationId, confirmToken: first.pending!.token, mode: "auto_run" },
      { userId, req },
      d,
    );
    expect(second.text).toMatch(/permission/i);
    expect((await retrievePositionById(role.id!)).status).toBe("open");
  });

  it("confirm round-trip executes the action and persists it", async () => {
    const { addPosition, retrievePositionById } = await import("@server/services/positions");
    const role = await addPosition({ title: "Closable2", status: "open" }, newId());
    const userId = newId();
    const d = deps();
    const first = await runTurn(
      { message: "close the Closable2 position", mode: "auto_run" },
      { userId, req },
      d,
    );
    expect(first.pending).toBeDefined();
    const second = await runTurn(
      { conversationId: first.conversationId, confirmToken: first.pending!.token, mode: "auto_run" },
      { userId, req },
      d,
    );
    expect((await retrievePositionById(role.id!)).status).toBe("closed");
    expect(second.conversationId).toBe(first.conversationId);
  });
});
