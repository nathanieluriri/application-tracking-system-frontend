import { AppError, ErrorCode, badRequest, notFound } from "@server/core/errors";
import { getDb, COLLECTIONS } from "@server/core/database";
import { isValidObjectId, toObjectId } from "@server/schemas/common";
import { getPosition } from "@server/repositories/positions";
import {
  createApplicationProcess,
  getApplicationProcess,
  getApplicationProcesses,
  updateApplicationProcess,
  deleteApplicationProcess,
  getDefaultProcess,
} from "@server/repositories/application-process";
import {
  applicationProcessCreateDoc,
  DEFAULT_STAGES,
  type ApplicationProcessCreateInput,
  type ApplicationProcessUpdateInput,
  type ApplicationProcessOut,
} from "@server/schemas/application-process";

/**
 * Application-process business logic, mirrors
 * `services/application_process_service.py`.
 */

export async function addApplicationProcess(
  input: ApplicationProcessCreateInput,
  createdBy: string | null = null,
): Promise<ApplicationProcessOut> {
  return createApplicationProcess(applicationProcessCreateDoc(input, createdBy));
}

export async function retrieveApplicationProcessById(id: string): Promise<ApplicationProcessOut> {
  if (!isValidObjectId(id)) throw badRequest("Invalid process ID format");
  const result = await getApplicationProcess({ _id: toObjectId(id)! });
  if (!result) throw notFound("Application process not found");
  return result;
}

export async function retrieveApplicationProcesses(start = 0, stop = 100) {
  return getApplicationProcesses(start, stop);
}

export async function updateApplicationProcessById(
  id: string,
  data: ApplicationProcessUpdateInput,
): Promise<ApplicationProcessOut> {
  if (!isValidObjectId(id)) throw badRequest("Invalid process ID format");

  if (data.stages !== undefined) {
    const newKeys = new Set(data.stages.map((s) => s.key));
    const db = await getDb();
    const existingStatuses: string[] = await db
      .collection(COLLECTIONS.applications)
      .distinct("status", { process_template_id: id });
    const orphans = existingStatuses.filter((s) => s && !newKeys.has(s));
    if (orphans.length > 0) {
      throw new AppError({
        status: 409,
        code: ErrorCode.CONFLICT,
        message: `Cannot update stages: applications still use status(es) ${orphans.join(", ")}`,
        details: { orphans },
      });
    }
  }

  const result = await updateApplicationProcess({ _id: toObjectId(id)! }, data);
  if (!result) throw notFound("Application process not found");
  return result;
}

export async function removeApplicationProcess(id: string): Promise<{ deleted: boolean }> {
  if (!isValidObjectId(id)) throw badRequest("Invalid process ID format");
  const existing = await getApplicationProcess({ _id: toObjectId(id)! });
  if (!existing) throw notFound("Application process not found");
  if (existing.is_system) throw notFound("System processes cannot be deleted");
  const result = await deleteApplicationProcess({ _id: toObjectId(id)! });
  if (result.deletedCount === 0) throw notFound("Application process not found");
  return { deleted: true };
}

export async function ensureDefaultProcess(): Promise<ApplicationProcessOut> {
  const existing = await getDefaultProcess();
  if (existing) return existing;
  return createApplicationProcess(
    applicationProcessCreateDoc({
      name: "Standard",
      description: "Default applicant pipeline",
      stages: DEFAULT_STAGES,
      require_cv: true,
      auto_acknowledge: true,
      is_system: true,
    }),
  );
}

export async function resolveProcessForPosition(positionId: string): Promise<ApplicationProcessOut> {
  if (!isValidObjectId(positionId)) throw badRequest("Invalid position ID format");
  const position = await getPosition({ _id: toObjectId(positionId)! });
  if (!position) throw notFound("Position not found");

  if (position.process_template_id && isValidObjectId(position.process_template_id)) {
    const process = await getApplicationProcess({ _id: toObjectId(position.process_template_id)! });
    if (process) return process;
  }

  const def = await getDefaultProcess();
  if (def) return def;
  return ensureDefaultProcess();
}
