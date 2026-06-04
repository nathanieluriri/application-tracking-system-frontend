import { badRequest, notFound } from "@server/core/errors";
import { isValidObjectId, toObjectId } from "@server/schemas/common";
import { QueueManager } from "@server/core/queue/manager";
import {
  createPosition,
  getPosition,
  getPositions,
  updatePosition,
  deletePosition,
  getPositionCountsByStatus,
} from "@server/repositories/positions";
import {
  positionCreateDoc,
  type PositionCreateInput,
  type PositionUpdateInput,
  type PositionOut,
} from "@server/schemas/positions";

/**
 * Position business logic, mirrors `services/position_service.py`.
 */

export async function addPosition(
  input: PositionCreateInput,
  createdBy: string,
): Promise<PositionOut> {
  return createPosition(positionCreateDoc(input, createdBy));
}

export async function retrievePositionById(id: string): Promise<PositionOut> {
  if (!isValidObjectId(id)) throw badRequest("Invalid position ID format");
  const result = await getPosition({ _id: toObjectId(id)! });
  if (!result) throw notFound("Position not found");
  return result;
}

export async function retrievePositions(opts: {
  status?: string;
  department?: string;
  start?: number;
  stop?: number;
}): Promise<PositionOut[]> {
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = opts.status;
  if (opts.department) filter.department = opts.department;
  return getPositions(filter, opts.start ?? 0, opts.stop ?? 100);
}

export async function retrieveOpenPositions(start = 0, stop = 100): Promise<PositionOut[]> {
  return getPositions({ status: "open" }, start, stop);
}

export async function updatePositionById(
  id: string,
  data: PositionUpdateInput,
): Promise<PositionOut> {
  if (!isValidObjectId(id)) throw badRequest("Invalid position ID format");
  const result = await updatePosition({ _id: toObjectId(id)! }, data);
  if (!result) throw notFound("Position not found or update failed");
  return result;
}

export async function closePosition(id: string): Promise<PositionOut> {
  if (!isValidObjectId(id)) throw badRequest("Invalid position ID format");
  const result = await updatePosition({ _id: toObjectId(id)! }, { status: "closed" });
  if (!result) throw notFound("Position not found");
  await QueueManager.enqueueSafely("close_position_cascade", { position_id: id });
  await QueueManager.enqueueSafely("dashboard_refresh", {});
  return result;
}

export async function removePosition(id: string): Promise<{ deleted: boolean }> {
  if (!isValidObjectId(id)) throw badRequest("Invalid position ID format");
  const result = await deletePosition({ _id: toObjectId(id)! });
  if (result.deletedCount === 0) throw notFound("Position not found");
  await QueueManager.enqueueSafely("dashboard_refresh", {});
  return { deleted: true };
}

export async function positionCountsByStatus(): Promise<Record<string, number>> {
  return getPositionCountsByStatus();
}
