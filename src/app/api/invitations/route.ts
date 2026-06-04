import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody, parseQuery } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { invitationCreateSchema } from "@server/schemas/invitations";
import { createInvitation, listInvitations } from "@server/services/invitations";

const listQuerySchema = z.object({
  start: z.coerce.number().int().min(0).optional(),
  stop: z.coerce.number().int().positive().optional(),
  // Default true: only the requesting admin's own invitations. Parsed as a raw
  // string (no transform) so parseQuery's input/output type stays aligned.
  mine_only: z.enum(["true", "false"]).optional(),
});

export const POST = withEnvelope(
  async (req) => {
    const admin = await checkAdminAccountStatusAndPermissions(req, "POST:/invitations");
    const body = await parseJsonBody(req, invitationCreateSchema);
    return createInvitation(body, admin.id!, admin.full_name);
  },
  { message: "Invitation created successfully", status: 201 },
);

export const GET = withEnvelope(
  async (req) => {
    const admin = await checkAdminAccountStatusAndPermissions(req, "GET:/invitations");
    const q = parseQuery(req, listQuerySchema);
    const mineOnly = q.mine_only !== "false"; // default true
    return listInvitations({
      inviterId: mineOnly ? admin.id : null,
      start: q.start,
      stop: q.stop,
    });
  },
  { message: "Invitations fetched successfully" },
);
