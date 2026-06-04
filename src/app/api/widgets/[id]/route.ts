import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { widgetUpdateSchema } from "@server/schemas/widgets";
import { retrieveWidgetById, updateWidgetById, removeWidget } from "@server/services/widgets";

export const GET = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/widgets/{widget_id}");
    const { id } = await ctx.params;
    return retrieveWidgetById(String(id));
  },
  { message: "Widget fetched successfully" },
);

export const PATCH = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "PATCH:/widgets/{widget_id}");
    const { id } = await ctx.params;
    const body = await parseJsonBody(req, widgetUpdateSchema);
    return updateWidgetById(String(id), body);
  },
  { message: "Widget updated successfully" },
);

export const DELETE = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "DELETE:/widgets/{widget_id}");
    const { id } = await ctx.params;
    return removeWidget(String(id));
  },
  { message: "Widget deleted successfully" },
);
