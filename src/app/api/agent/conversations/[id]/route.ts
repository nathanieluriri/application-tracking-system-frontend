import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { requireAny } from "@server/http/guards";
import {
  getForOwner,
  renameForOwner,
  setFeedbackForOwner,
  deleteForOwner,
} from "@server/services/conversations";

export const GET = withEnvelope(
  async (req, ctx) => {
    const principal = await requireAny(req);
    const { id } = await ctx.params;
    return getForOwner(String(id), principal.userId);
  },
  { message: "Conversation fetched" },
);

const patchBody = z.object({
  title: z.string().optional(),
  messageId: z.string().optional(),
  feedback: z.enum(["up", "down"]).nullable().optional(),
});

export const PATCH = withEnvelope(
  async (req, ctx) => {
    const principal = await requireAny(req);
    const { id } = await ctx.params;
    const body = await parseJsonBody(req, patchBody);
    if (body.messageId !== undefined && body.feedback !== undefined) {
      return setFeedbackForOwner(String(id), principal.userId, body.messageId, body.feedback);
    }
    if (body.title !== undefined) {
      return renameForOwner(String(id), principal.userId, body.title);
    }
    return getForOwner(String(id), principal.userId);
  },
  { message: "Conversation updated" },
);

export const DELETE = withEnvelope(
  async (req, ctx) => {
    const principal = await requireAny(req);
    const { id } = await ctx.params;
    return deleteForOwner(String(id), principal.userId);
  },
  { message: "Conversation deleted" },
);
