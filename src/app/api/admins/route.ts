import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody, parseQuery } from "@server/http/request";
import { authResponse } from "@server/http/auth-response";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { adminSignupSchema } from "@server/schemas/admins";
import { addAdmin, retrieveAdmins } from "@server/services/admins";

const listQuerySchema = z.object({
  start: z.coerce.number().int().min(0).optional(),
  stop: z.coerce.number().int().positive().optional(),
});

export const GET = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/admins");
    const { start, stop } = parseQuery(req, listQuerySchema);
    return retrieveAdmins(start, stop);
  },
  { message: "Admins fetched successfully" },
);

export const POST = withEnvelope(async (req) => {
  const admin = await checkAdminAccountStatusAndPermissions(req, "POST:/admins/signup");
  const body = await parseJsonBody(req, adminSignupSchema);
  const created = await addAdmin({ ...body, invited_by: admin.id! });
  return authResponse(req, created, "Admin created successfully", 201);
});
