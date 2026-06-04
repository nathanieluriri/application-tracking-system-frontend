import { badRequest, notFound } from "@server/core/errors";
import { AppError, ErrorCode } from "@server/core/errors";
import { isValidObjectId, toObjectId } from "@server/schemas/common";
import { QueueManager } from "@server/core/queue/manager";
import { getPosition } from "@server/repositories/positions";
import { resolveProcessForPosition } from "@server/services/application-process";
import {
  createApplication,
  getApplication,
  getApplications,
  updateApplication,
  deleteApplication,
  bulkUpdateStatus,
  appendStatusHistory,
  existingRecentSubmission,
} from "@server/repositories/applications";
import {
  applicationCreate,
  statusHistoryEntry,
  type ApplicationOut,
  type ApplicationUpdateInput,
} from "@server/schemas/applications";
import type { Stage, ApplicationProcessOut } from "@server/schemas/application-process";

/**
 * Application business logic, mirrors `services/application_service.py`.
 */

function stageForStatus(process: ApplicationProcessOut, statusKey: string): Stage | null {
  return process.stages.find((s) => s.key === statusKey) ?? null;
}

export async function submitApplication(input: {
  full_name: string;
  email: string;
  phone?: string | null;
  position_id: string;
  experience?: string | null;
  location?: string | null;
  cv_document_id?: string | null;
}): Promise<ApplicationOut> {
  if (!isValidObjectId(input.position_id)) throw badRequest("Invalid position ID format");

  const position = await getPosition({ _id: toObjectId(input.position_id)! });
  if (!position || position.status !== "open") {
    throw notFound("Position is not accepting applications");
  }

  const process = await resolveProcessForPosition(input.position_id);
  if (process.require_cv && !input.cv_document_id) {
    throw badRequest("CV is required for this position");
  }

  if (await existingRecentSubmission(input.email, input.position_id)) {
    throw new AppError({
      status: 429,
      code: ErrorCode.TOO_MANY_REQUESTS,
      message: "A recent application already exists for this email and position",
    });
  }

  const initialStage = process.stages[0]?.key ?? "new";
  const application = await createApplication(
    applicationCreate({
      ...input,
      status: initialStage,
      process_template_id: process.id,
    }),
  );

  await appendStatusHistory(
    statusHistoryEntry({
      application_id: application.id!,
      from_status: null,
      to_status: initialStage,
    }),
  );

  if (process.auto_acknowledge) {
    await QueueManager.enqueueSafely("send_application_acknowledgement", {
      application_id: application.id,
      email: input.email,
      full_name: input.full_name,
      position_title: position.title,
    });
  }
  await QueueManager.enqueueSafely("dashboard_refresh", {});

  application.position_title = position.title;
  return application;
}

export async function updateApplicationStatus(
  applicationId: string,
  newStatus: string,
  changedBy: string | null = null,
): Promise<ApplicationOut> {
  if (!isValidObjectId(applicationId)) throw badRequest("Invalid application ID format");

  const existing = await getApplication({ _id: toObjectId(applicationId)! });
  if (!existing) throw notFound("Application not found");

  const process = await resolveProcessForPosition(existing.position_id);
  const stage = stageForStatus(process, newStatus);
  if (!stage) {
    throw badRequest(`Status '${newStatus}' is not part of the application process`);
  }

  const updated = await updateApplication({ _id: toObjectId(applicationId)! }, { status: newStatus });
  if (!updated) throw notFound("Application not found");

  await appendStatusHistory(
    statusHistoryEntry({
      application_id: applicationId,
      from_status: existing.status,
      to_status: newStatus,
      changed_by: changedBy,
    }),
  );

  if (stage.requires_email) {
    await QueueManager.enqueueSafely("send_status_change_email", {
      application_id: applicationId,
      to_email: existing.email,
      full_name: existing.full_name,
      status: newStatus,
      template_id: stage.email_template_id ?? null,
    });
  }
  await QueueManager.enqueueSafely("dashboard_refresh", {});
  return updated;
}

export async function bulkUpdateApplicationStatus(
  ids: string[],
  newStatus: string,
  changedBy: string | null = null,
): Promise<number> {
  const modified = await bulkUpdateStatus(ids, newStatus);

  for (const appId of ids) {
    if (!isValidObjectId(appId)) continue;
    const existing = await getApplication({ _id: toObjectId(appId)! });
    if (!existing) continue;
    await appendStatusHistory(
      statusHistoryEntry({
        application_id: appId,
        from_status: existing.status,
        to_status: newStatus,
        changed_by: changedBy,
      }),
    );
    await QueueManager.enqueueSafely("send_status_change_email", {
      application_id: appId,
      to_email: existing.email,
      full_name: existing.full_name,
      status: newStatus,
      template_id: null,
    });
  }

  await QueueManager.enqueueSafely("dashboard_refresh", {});
  return modified;
}

export async function patchApplication(
  applicationId: string,
  payload: ApplicationUpdateInput,
): Promise<void> {
  if (payload.rating == null && payload.notes == null && payload.cv_document_id == null) return;
  if (!isValidObjectId(applicationId)) throw badRequest("Invalid application ID format");
  await updateApplication(
    { _id: toObjectId(applicationId)! },
    {
      rating: payload.rating ?? undefined,
      notes: payload.notes ?? undefined,
      cv_document_id: payload.cv_document_id ?? undefined,
    },
  );
}

export async function retrieveApplication(applicationId: string): Promise<ApplicationOut> {
  if (!isValidObjectId(applicationId)) throw badRequest("Invalid application ID format");
  const result = await getApplication({ _id: toObjectId(applicationId)! });
  if (!result) throw notFound("Application not found");

  if (result.position_id && isValidObjectId(result.position_id)) {
    const position = await getPosition({ _id: toObjectId(result.position_id)! });
    if (position) result.position_title = position.title;
  }
  return result;
}

export async function retrieveApplications(opts: {
  status?: string;
  position_id?: string;
  search?: string;
  start?: number;
  stop?: number;
}): Promise<ApplicationOut[]> {
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = opts.status;
  if (opts.position_id) filter.position_id = opts.position_id;
  if (opts.search) {
    filter.$or = [
      { full_name: { $regex: opts.search, $options: "i" } },
      { email: { $regex: opts.search, $options: "i" } },
    ];
  }
  const items = await getApplications(filter, opts.start ?? 0, opts.stop ?? 100);

  const titles = new Map<string, string>();
  for (const item of items) {
    if (item.position_id && !titles.has(item.position_id) && isValidObjectId(item.position_id)) {
      const pos = await getPosition({ _id: toObjectId(item.position_id)! });
      if (pos) titles.set(item.position_id, pos.title);
    }
    item.position_title = titles.get(item.position_id) ?? null;
  }
  return items;
}

export async function removeApplication(applicationId: string): Promise<{ deleted: boolean }> {
  if (!isValidObjectId(applicationId)) throw badRequest("Invalid application ID format");
  const result = await deleteApplication({ _id: toObjectId(applicationId)! });
  if (result.deletedCount === 0) throw notFound("Application not found");
  await QueueManager.enqueueSafely("dashboard_refresh", {});
  return { deleted: true };
}
