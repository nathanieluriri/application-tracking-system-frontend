import { z } from "zod";
import type { ToolDef } from "./types";
import {
  addPosition,
  updatePositionById,
  closePosition,
  retrievePositions,
  retrievePositionById,
} from "@server/services/positions";
import { employmentTypeValues } from "@server/schemas/positions";

const createSchema = z.object({
  title: z.string().min(1),
  department: z.string().optional(),
  location: z.string().optional(),
  employment_type: z.enum(employmentTypeValues).optional(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
});

const createTool: ToolDef<typeof createSchema> = {
  name: "positions.create",
  description:
    "Create a new job posting as a DRAFT. Provide a complete, detailed posting: title, department, location, employment type, a multi-paragraph description, and a list of requirements.",
  risk: "write",
  permission: "POST:/positions",
  schema: createSchema,
  preview: (a) =>
    `Create a draft job posting "${a.title}"${a.department ? ` in ${a.department}` : ""}.`,
  execute: async (a, ctx) => {
    const created = await addPosition({ ...a, status: "draft" }, ctx.userId);
    return { summary: `Created draft posting "${created.title}"`, data: created };
  },
};

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  employment_type: z.enum(employmentTypeValues).optional(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  status: z.enum(["open", "closed", "draft"]).optional(),
});

const updateTool: ToolDef<typeof updateSchema> = {
  name: "positions.update",
  description: "Update fields on an existing job posting by id.",
  risk: "write",
  permission: "PATCH:/positions/{position_id}",
  schema: updateSchema,
  preview: (a) => `Update posting ${a.id}.`,
  execute: async (a, _ctx) => {
    const { id, ...rest } = a;
    const updated = await updatePositionById(id, rest);
    return { summary: `Updated posting "${updated.title}"`, data: updated };
  },
};

const closeSchema = z.object({ id: z.string().min(1) });

const closeTool: ToolDef<typeof closeSchema> = {
  name: "positions.close",
  description: "Close an open job posting by id. This stops new applications.",
  risk: "destructive",
  permission: "POST:/positions/{position_id}/close",
  schema: closeSchema,
  preview: (a) => `Close posting ${a.id}. New applications will stop.`,
  execute: async (a, _ctx) => {
    const closed = await closePosition(a.id);
    return { summary: `Closed posting "${closed.title}"`, data: closed };
  },
};

const listSchema = z.object({
  status: z.enum(["open", "closed", "draft"]).optional(),
  department: z.string().optional(),
});

const listTool: ToolDef<typeof listSchema> = {
  name: "positions.list",
  description: "List job postings, optionally filtered by status or department.",
  risk: "read",
  permission: "GET:/positions",
  schema: listSchema,
  preview: () => "List job postings.",
  execute: async (a, _ctx) => {
    const items = await retrievePositions({ ...a, start: 0, stop: 100 });
    return { summary: `Found ${items.length} posting(s)`, data: items };
  },
};

const getSchema = z.object({ id: z.string().min(1) });

const getTool: ToolDef<typeof getSchema> = {
  name: "positions.get",
  description: "Get a single job posting by id.",
  risk: "read",
  permission: "GET:/positions/{position_id}",
  schema: getSchema,
  preview: (a) => `Show posting ${a.id}.`,
  execute: async (a, _ctx) => {
    const p = await retrievePositionById(a.id);
    return { summary: `Posting "${p.title}"`, data: p };
  },
};

export const positionsTools: ToolDef[] = [
  createTool,
  updateTool,
  closeTool,
  listTool,
  getTool,
] as unknown as ToolDef[];
