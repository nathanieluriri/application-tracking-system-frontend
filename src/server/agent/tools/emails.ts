import { z } from "zod";
import type { ToolDef } from "./types";
import { composeAndSend } from "@server/services/outbound-emails";
import {
  addEmailTemplate,
  retrieveEmailTemplates,
} from "@server/services/email-templates";

const draftSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  recipient_name: z.string().optional(),
});

const draftTool: ToolDef<typeof draftSchema> = {
  name: "emails.draft",
  description:
    "Compose a draft email and return it for review. Does NOT send or save anything.",
  risk: "read",
  permission: "GET:/email-templates",
  schema: draftSchema,
  preview: () => "Draft an email (no send).",
  execute: async (a, _ctx) => {
    return {
      summary: "Draft email ready.",
      data: { subject: a.subject, body: a.body },
    };
  },
};

const listTemplatesSchema = z.object({});

const listTemplatesTool: ToolDef<typeof listTemplatesSchema> = {
  name: "templates.list",
  description: "List available email templates.",
  risk: "read",
  permission: "GET:/email-templates",
  schema: listTemplatesSchema,
  preview: () => "List email templates.",
  execute: async (_a, _ctx) => {
    const items = await retrieveEmailTemplates(0, 100);
    return { summary: `Found ${items.length} template(s)`, data: items };
  },
};

const createTemplateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  html_body: z.string().min(1),
});

const createTemplateTool: ToolDef<typeof createTemplateSchema> = {
  name: "templates.create",
  description: "Create a new email template.",
  risk: "write",
  permission: "POST:/email-templates",
  schema: createTemplateSchema,
  preview: (a) => `Create email template "${a.name}".`,
  execute: async (a, ctx) => {
    const created = await addEmailTemplate(a, ctx.userId);
    return { summary: `Created template "${created.name}"`, data: created };
  },
};

const sendSchema = z.object({
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        application_id: z.string().optional(),
      }),
    )
    .min(1),
  subject: z.string().optional(),
  html_body: z.string().optional(),
  template_id: z.string().optional(),
});

const sendTool: ToolDef<typeof sendSchema> = {
  name: "emails.send",
  description:
    "Send emails to one or more recipients using either a template or inline subject + body.",
  risk: "destructive",
  permission: "POST:/emails/compose",
  schema: sendSchema,
  preview: (a) => `Send an email to ${a.recipients.length} recipient(s).`,
  execute: async (a, ctx) => {
    const sent = await composeAndSend(a, ctx.userId);
    return { summary: `Queued ${sent.length} email(s) to send`, data: sent };
  },
};

export const emailsTools: ToolDef[] = [
  draftTool,
  listTemplatesTool,
  createTemplateTool,
  sendTool,
] as unknown as ToolDef[];
