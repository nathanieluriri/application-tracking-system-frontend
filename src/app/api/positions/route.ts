import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody, parseQuery } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { positionCreateSchema } from "@server/schemas/positions";
import { addPosition, retrievePositions } from "@server/services/positions";

const listQuerySchema = z.object({
  start: z.coerce.number().int().min(0).optional(),
  stop: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  department: z.string().optional(),
});

export const GET = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/positions");
    const q = parseQuery(req, listQuerySchema);
    return retrievePositions(q);
  },
  { message: "Positions fetched successfully" },
);

export const POST = withEnvelope(
  async (req) => {
    const admin = await checkAdminAccountStatusAndPermissions(req, "POST:/positions");
    const body = await parseJsonBody(req, positionCreateSchema);
    return addPosition(body, admin.id!);
  },
  { message: "Position created successfully", status: 201 },
);
