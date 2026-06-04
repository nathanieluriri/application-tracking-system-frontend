import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseQuery } from "@server/http/request";
import { retrieveOpenPositions } from "@server/services/positions";

const publicQuerySchema = z.object({
  start: z.coerce.number().int().min(0).optional(),
  stop: z.coerce.number().int().positive().optional(),
});

export const GET = withEnvelope(
  async (req) => {
    const q = parseQuery(req, publicQuerySchema);
    return retrieveOpenPositions(q.start ?? 0, q.stop ?? 100);
  },
  { message: "Open positions fetched successfully" },
);
