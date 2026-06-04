import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "@server/agent/tools/registry";
import type { ToolDef } from "@server/agent/tools/types";

const sample: ToolDef = {
  name: "positions.create",
  description: "Create a job posting",
  risk: "write",
  permission: "POST:/positions",
  schema: z.object({ title: z.string(), department: z.string().optional() }),
  preview: (a) => `Create posting "${a.title}"`,
  execute: async () => ({ summary: "created" }),
};

describe("ToolRegistry", () => {
  it("registers and retrieves tools", () => {
    const r = new ToolRegistry();
    r.register(sample);
    expect(r.get("positions.create")).toBe(sample);
    expect(r.all()).toHaveLength(1);
  });

  it("rejects duplicate names", () => {
    const r = new ToolRegistry();
    r.register(sample);
    expect(() => r.register(sample)).toThrow(/already registered/);
  });

  it("get() returns undefined for unknown tool", () => {
    expect(new ToolRegistry().get("nope")).toBeUndefined();
  });

  it("toGeminiDeclarations emits name+description+object params", () => {
    const r = new ToolRegistry();
    r.register(sample);
    const decls = r.toGeminiDeclarations();
    expect(decls).toHaveLength(1);
    expect(decls[0].name).toBe("positions.create");
    expect(decls[0].parameters.type).toBe("object");
    expect(decls[0].parameters.properties.title.type).toBe("string");
    expect(decls[0].parameters.required).toContain("title");
  });

  it("toGeminiDeclarations correctly unwraps optional fields", () => {
    const r = new ToolRegistry();
    const toolWithOptionalNumber: ToolDef = {
      name: "test.optional",
      description: "Test optional field unwrapping",
      risk: "read",
      permission: "GET:/test",
      schema: z.object({ count: z.number().optional() }),
      preview: () => "test",
      execute: async () => ({ summary: "done" }),
    };
    r.register(toolWithOptionalNumber);
    const decls = r.toGeminiDeclarations();
    expect(decls[0].parameters.properties.count.type).toBe("number");
    expect(decls[0].parameters.required).not.toContain("count");
  });
});
