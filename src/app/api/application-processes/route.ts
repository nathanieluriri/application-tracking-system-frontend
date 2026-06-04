import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody, parseQuery } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { applicationProcessCreateSchema } from "@server/schemas/application-process";
import {
  addApplicationProcess,
  retrieveApplicationProcesses,
} from "@server/services/application-process";

const listQuerySchema = z.object({
  start: z.coerce.number().int().min(0).optional(),
  stop: z.coerce.number().int().positive().optional(),
});

export const GET = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/application-processes");
    const q = parseQuery(req, listQuerySchema);
    return retrieveApplicationProcesses(q.start, q.stop);
  },
  { message: "Application processes fetched successfully" },
);

export const POST = withEnvelope(
  async (req) => {
    const admin = await checkAdminAccountStatusAndPermissions(req, "POST:/application-processes");
    const body = await parseJsonBody(req, applicationProcessCreateSchema);
    return addApplicationProcess(body, admin.id);
  },
  { message: "Application process created successfully", status: 201 },
);
