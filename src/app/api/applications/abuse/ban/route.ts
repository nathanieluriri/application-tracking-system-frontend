import { withEnvelope } from "@server/http/with-envelope";
import { badRequest } from "@server/core/errors";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { banIp } from "@server/security/abuse-control";

export const POST = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "POST:/applications/abuse/ban");
    const form = await req.formData();
    const ip = form.get("ip");
    if (!ip || typeof ip !== "string") throw badRequest("ip is required");
    await banIp(ip);
    return { banned: true, ip };
  },
  { message: "IP banned" },
);
