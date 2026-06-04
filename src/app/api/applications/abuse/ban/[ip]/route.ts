import { withEnvelope } from "@server/http/with-envelope";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { unbanIp } from "@server/security/abuse-control";

export const DELETE = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "DELETE:/applications/abuse/ban/{ip}");
    const { ip } = await ctx.params;
    await unbanIp(String(ip));
    return { unbanned: true, ip: String(ip) };
  },
  { message: "IP unbanned" },
);
