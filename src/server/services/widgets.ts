import { badRequest, notFound } from "@server/core/errors";
import { isValidObjectId, toObjectId } from "@server/schemas/common";
import {
  createWidget,
  getWidget,
  getWidgets,
  updateWidget,
  deleteWidget,
} from "@server/repositories/widgets";
import {
  widgetCreateDoc,
  widgetUpdateSet,
  widgetRenderConfig,
  type WidgetCreateInput,
  type WidgetUpdateInput,
  type WidgetOut,
} from "@server/schemas/widgets";
import { selectWidgetRoles } from "@server/services/widget-roles";
import { retrieveOpenPositions } from "@server/services/positions";

/**
 * Widget business logic. Admin CRUD + duplicate, plus the public render payload
 * (config + filtered open roles). Mirrors the FastAPI widget service.
 */

export async function addWidget(input: WidgetCreateInput, createdBy: string): Promise<WidgetOut> {
  return createWidget(widgetCreateDoc(input, createdBy));
}

export async function retrieveWidgets(start = 0, stop = 100): Promise<WidgetOut[]> {
  return getWidgets(start, stop);
}

export async function retrieveWidgetById(id: string): Promise<WidgetOut> {
  if (!isValidObjectId(id)) throw badRequest("Invalid widget ID format");
  const result = await getWidget({ _id: toObjectId(id)! });
  if (!result) throw notFound("Widget not found");
  return result;
}

export async function updateWidgetById(id: string, input: WidgetUpdateInput): Promise<WidgetOut> {
  if (!isValidObjectId(id)) throw badRequest("Invalid widget ID format");
  const result = await updateWidget({ _id: toObjectId(id)! }, widgetUpdateSet(input));
  if (!result) throw notFound("Widget not found or update failed");
  return result;
}

export async function removeWidget(id: string): Promise<{ deleted: boolean }> {
  if (!isValidObjectId(id)) throw badRequest("Invalid widget ID format");
  const result = await deleteWidget({ _id: toObjectId(id)! });
  if (result.deletedCount === 0) throw notFound("Widget not found");
  return { deleted: true };
}

export async function duplicateWidget(id: string, createdBy: string): Promise<WidgetOut> {
  const original = await retrieveWidgetById(id);
  // `original` is a stored, already-validated widget; its filters/content satisfy
  // the create input (the enum-typed employment_types is widened to string[] on
  // the stored doc, so assert the input shape here).
  const config: WidgetCreateInput = {
    name: `${original.name} (copy)`,
    status: original.status,
    layout: original.layout,
    theme: original.theme,
    content: original.content,
    filters: original.filters as WidgetCreateInput["filters"],
    behavior: original.behavior,
  };
  return createWidget(widgetCreateDoc(config, createdBy));
}

/**
 * Public render payload: widget config + its filtered open roles.
 * Missing widget -> 404. Disabled -> minimal flag + empty roles (the renderer
 * shows a graceful empty state rather than an error).
 */
export async function retrieveWidgetPublicData(
  id: string,
): Promise<{ widget: Record<string, unknown>; roles: unknown[] }> {
  const widget = await retrieveWidgetById(id);
  if (widget.status === "disabled") {
    return { widget: { status: "disabled" }, roles: [] };
  }
  const openRoles = await retrieveOpenPositions(0, 1000);
  const roles = selectWidgetRoles(openRoles, widget.filters);
  return { widget: widgetRenderConfig(widget), roles };
}
