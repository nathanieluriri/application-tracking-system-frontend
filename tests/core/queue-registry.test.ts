import { describe, it, expect, beforeEach } from "vitest";
import {
  registerTask,
  executeRegisteredTask,
  listRegisteredTaskKeys,
  clearRegistry,
} from "@server/core/queue/registry";
import { InlineJobProvider } from "@server/core/queue/provider";
import { QueueManager } from "@server/core/queue/manager";

describe("queue registry", () => {
  beforeEach(() => clearRegistry());

  it("registers and executes a task by key", async () => {
    registerTask("greet", async ({ name }: { name: string }) => `hi ${name}`);
    expect(await executeRegisteredTask("greet", { name: "x" })).toBe("hi x");
    expect(listRegisteredTaskKeys()).toEqual(["greet"]);
  });

  it("throws on duplicate registration", () => {
    registerTask("dup", async () => 1);
    expect(() => registerTask("dup", async () => 2)).toThrow(/already registered/);
  });

  it("throws on unknown key", async () => {
    await expect(executeRegisteredTask("nope", {})).rejects.toThrow(/not registered/);
  });
});

describe("InlineJobProvider + QueueManager", () => {
  beforeEach(() => clearRegistry());

  it("runs the registered handler when enqueued", async () => {
    let captured: unknown = null;
    registerTask("capture", async (payload: unknown) => {
      captured = payload;
    });
    QueueManager.configure(new InlineJobProvider());
    await QueueManager.getInstance().enqueue("capture", { v: 42 });
    expect(captured).toEqual({ v: 42 });
  });
});
