import { z } from "zod";
import type { ToolDef } from "./types";
import {
  retrieveApplications,
  retrieveApplication,
  updateApplicationStatus,
  patchApplication,
  bulkUpdateApplicationStatus,
} from "@server/services/applications";

const searchSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  position_id: z.string().optional(),
});

const searchTool: ToolDef<typeof searchSchema> = {
  name: "applicants.search",
  description: "Search applicants by name, email, status, or position. Returns up to 100 results.",
  risk: "read",
  permission: "GET:/applications",
  schema: searchSchema,
  preview: () => "Search applicants.",
  execute: async (a, _ctx) => {
    const items = await retrieveApplications({ ...a, start: 0, stop: 100 });
    return { summary: `Found ${items.length} applicant(s)`, data: items };
  },
};

const getSchema = z.object({ id: z.string().min(1) });

const getTool: ToolDef<typeof getSchema> = {
  name: "applicants.get",
  description: "Get a single applicant by id.",
  risk: "read",
  permission: "GET:/applications/{application_id}",
  schema: getSchema,
  preview: (a) => `Show applicant ${a.id}.`,
  execute: async (a, _ctx) => {
    const app = await retrieveApplication(a.id);
    return { summary: app.full_name, data: app };
  },
};

const moveSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
});

const moveTool: ToolDef<typeof moveSchema> = {
  name: "applicants.move",
  description: "Move an applicant to a different pipeline stage (status).",
  risk: "write",
  permission: "PATCH:/applications/{application_id}",
  schema: moveSchema,
  preview: (a) => `Move applicant ${a.id} to ${a.status}.`,
  execute: async (a, ctx) => {
    const updated = await updateApplicationStatus(a.id, a.status, ctx.userId);
    return { summary: `Moved ${updated.full_name} to ${a.status}`, data: updated };
  },
};

const noteSchema = z.object({
  id: z.string().min(1),
  note: z.string().min(1),
});

const noteTool: ToolDef<typeof noteSchema> = {
  name: "applicants.note",
  description: "Add or replace the recruiter note on an applicant.",
  risk: "write",
  permission: "PATCH:/applications/{application_id}",
  schema: noteSchema,
  preview: (a) => `Add a note to applicant ${a.id}.`,
  execute: async (a, _ctx) => {
    await patchApplication(a.id, { notes: a.note });
    return { summary: "Added a note to the applicant." };
  },
};

const bulkStatusSchema = z.object({
  ids: z.array(z.string()).min(1),
  status: z.string().min(1),
});

const bulkStatusTool: ToolDef<typeof bulkStatusSchema> = {
  name: "applicants.bulkStatus",
  description: "Move multiple applicants to a new pipeline stage at once.",
  risk: "write",
  permission: "POST:/applications/bulk/status",
  schema: bulkStatusSchema,
  preview: (a) => `Update ${a.ids.length} applicants to ${a.status}.`,
  execute: async (a, ctx) => {
    const n = await bulkUpdateApplicationStatus(a.ids, a.status, ctx.userId);
    return { summary: `Updated ${n} applicant(s)`, data: { updated: n } };
  },
};

export const applicantsTools: ToolDef[] = [
  searchTool,
  getTool,
  moveTool,
  noteTool,
  bulkStatusTool,
] as unknown as ToolDef[];
