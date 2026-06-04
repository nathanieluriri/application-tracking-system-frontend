import { z } from "zod";
import type { ToolDef } from "./types";
import { addWidget, retrieveWidgets, duplicateWidget } from "@server/services/widgets";
import { createInvitation, listInvitations, revokeInvitation } from "@server/services/invitations";
import { retrieveSettings, saveSettings } from "@server/services/settings";

// ── Widgets ──────────────────────────────────────────────────────────────────

const widgetsListSchema = z.object({});

const widgetsListTool: ToolDef<typeof widgetsListSchema> = {
  name: "widgets.list",
  description: "List all career-portal widgets.",
  risk: "read",
  permission: "GET:/widgets",
  schema: widgetsListSchema,
  preview: () => "List widgets.",
  execute: async (_a, _ctx) => {
    const items = await retrieveWidgets(0, 100);
    return { summary: `Found ${items.length} widget(s)`, data: items };
  },
};

const widgetsCreateSchema = z.object({
  name: z.string().min(1),
});

const widgetsCreateTool: ToolDef<typeof widgetsCreateSchema> = {
  name: "widgets.create",
  description: "Create a new career-portal widget.",
  risk: "write",
  permission: "POST:/widgets",
  schema: widgetsCreateSchema,
  preview: (a) => `Create widget "${a.name}".`,
  execute: async (a, ctx) => {
    const created = await addWidget({ name: a.name }, ctx.userId);
    return { summary: `Created widget "${created.name}"`, data: created };
  },
};

const widgetsDuplicateSchema = z.object({
  id: z.string().min(1),
});

const widgetsDuplicateTool: ToolDef<typeof widgetsDuplicateSchema> = {
  name: "widgets.duplicate",
  description: "Duplicate an existing career-portal widget by id.",
  risk: "write",
  permission: "POST:/widgets/{widget_id}/duplicate",
  schema: widgetsDuplicateSchema,
  preview: (a) => `Duplicate widget ${a.id}.`,
  execute: async (a, ctx) => {
    const created = await duplicateWidget(a.id, ctx.userId);
    return { summary: `Duplicated widget "${created.name}"`, data: created };
  },
};

// ── Invitations ───────────────────────────────────────────────────────────────

const invitationsListSchema = z.object({
  status: z.string().optional(),
});

const invitationsListTool: ToolDef<typeof invitationsListSchema> = {
  name: "invitations.list",
  description: "List admin invitations.",
  risk: "read",
  permission: "GET:/invitations",
  schema: invitationsListSchema,
  preview: () => "List invitations.",
  execute: async (_a, _ctx) => {
    const items = await listInvitations({ start: 0, stop: 100 });
    return { summary: `Found ${items.length} invitation(s)`, data: items };
  },
};

const invitationsCreateSchema = z.object({
  invitee_email: z.string().email(),
  note: z.string().optional(),
});

const invitationsCreateTool: ToolDef<typeof invitationsCreateSchema> = {
  name: "invitations.create",
  description:
    "Send an admin invitation email to the given address. DESTRUCTIVE — triggers an outbound email immediately.",
  risk: "destructive",
  permission: "POST:/invitations",
  schema: invitationsCreateSchema,
  preview: (a) => `Send an admin invitation to ${a.invitee_email}.`,
  execute: async (a, ctx) => {
    const created = await createInvitation(
      { invitee_email: a.invitee_email, note: a.note },
      ctx.userId,
    );
    return { summary: `Invited ${created.invitee_email}`, data: created };
  },
};

const invitationsRevokeSchema = z.object({
  id: z.string().min(1),
});

const invitationsRevokeTool: ToolDef<typeof invitationsRevokeSchema> = {
  name: "invitations.revoke",
  description:
    "Revoke a pending admin invitation by id. DESTRUCTIVE — the invite link becomes immediately invalid.",
  risk: "destructive",
  permission: "POST:/invitations/{invitation_id}/revoke",
  schema: invitationsRevokeSchema,
  preview: (a) => `Revoke invitation ${a.id}.`,
  execute: async (a, _ctx) => {
    const revoked = await revokeInvitation(a.id);
    return { summary: `Revoked invitation ${revoked.id}`, data: revoked };
  },
};

// ── Settings ──────────────────────────────────────────────────────────────────

const settingsGetSchema = z.object({});

const settingsGetTool: ToolDef<typeof settingsGetSchema> = {
  name: "settings.get",
  description: "Retrieve the current organisation settings.",
  risk: "read",
  permission: "GET:/settings",
  schema: settingsGetSchema,
  preview: () => "Show current settings.",
  execute: async (_a, _ctx) => {
    const settings = await retrieveSettings();
    return { summary: "Current settings", data: settings };
  },
};

// v1 minimal surface: expose sender_name from the email sub-object.
// emailSettings has { reply_to, sender_name } — sender_name is a simple scalar.
const settingsUpdateSchema = z.object({
  sender_name: z.string().optional(),
});

const settingsUpdateTool: ToolDef<typeof settingsUpdateSchema> = {
  name: "settings.update",
  description:
    "Update organisation settings. Currently supports setting the email sender name.",
  risk: "write",
  permission: "PUT:/settings",
  schema: settingsUpdateSchema,
  preview: () => "Update settings.",
  execute: async (a, _ctx) => {
    const updated = await saveSettings({
      email: a.sender_name != null ? { sender_name: a.sender_name } : undefined,
    });
    return { summary: "Updated settings", data: updated };
  },
};

// ── Export ────────────────────────────────────────────────────────────────────

export const adminTools: ToolDef[] = [
  widgetsListTool,
  widgetsCreateTool,
  widgetsDuplicateTool,
  invitationsListTool,
  invitationsCreateTool,
  invitationsRevokeTool,
  settingsGetTool,
  settingsUpdateTool,
] as unknown as ToolDef[];
