import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseQuery, parseJsonBody } from "@server/http/request";
import { requireAny } from "@server/http/guards";
import { listForOwner, startConversation } from "@server/services/conversations";

const listQuery = z.object({
  start: z.coerce.number().int().min(0).optional(),
  stop: z.coerce.number().int().positive().optional(),
});

export const GET = withEnvelope(
  async (req) => {
    const principal = await requireAny(req);
    const q = parseQuery(req, listQuery);
    return listForOwner(principal.userId, q.start ?? 0, q.stop ?? 50);
  },
  { message: "Conversations fetched" },
);

const createBody = z.object({ firstMessage: z.string().min(1) });

export const POST = withEnvelope(
  async (req) => {
    const principal = await requireAny(req);
    const body = await parseJsonBody(req, createBody);
    return startConversation(principal.userId, body.firstMessage);
  },
  { message: "Conversation created", status: 201 },
);
