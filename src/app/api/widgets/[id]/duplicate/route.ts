import { withEnvelope } from "@server/http/with-envelope";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { duplicateWidget } from "@server/services/widgets";

export const POST = withEnvelope(
  async (req, ctx) => {
    const admin = await checkAdminAccountStatusAndPermissions(req, "POST:/widgets/{widget_id}/duplicate");
    const { id } = await ctx.params;
    return duplicateWidget(String(id), admin.id!);
  },
  { message: "Widget duplicated successfully", status: 201 },
);
