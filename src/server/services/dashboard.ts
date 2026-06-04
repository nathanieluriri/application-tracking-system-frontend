import { cacheGet, cacheSet } from "@server/core/cache";
import { nowSeconds, isValidObjectId, toObjectId } from "@server/schemas/common";
import {
  countByStatus,
  countByPosition,
  countByWeek,
  countNewThisWeek,
  avgTimeToHireSeconds,
} from "@server/repositories/applications";
import { getPosition, getPositionCountsByStatus } from "@server/repositories/positions";

/**
 * Dashboard overview aggregation, mirrors `services/dashboard_service.py`.
 * The Redis cache is replaced by the in-process TTL cache.
 */

const DASHBOARD_CACHE_KEY = "dashboard:overview";
const DASHBOARD_CACHE_TTL = 60;

export async function computeOverviewMetrics(): Promise<Record<string, unknown>> {
  const statusCounts = await countByStatus();
  const totalApplications = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const newThisWeek = await countNewThisWeek();

  const accepted = statusCounts.accepted ?? 0;
  const rejected = statusCounts.rejected ?? 0;
  const decided = accepted + rejected;
  const acceptanceRate = decided ? Math.round((accepted / decided) * 100 * 100) / 100 : 0;

  const avgSeconds = await avgTimeToHireSeconds();
  const avgDays = avgSeconds ? Math.round((avgSeconds / 86400) * 10) / 10 : 0;

  const positionStatusCounts = await getPositionCountsByStatus();
  const weekly = await countByWeek(5);

  const byPositionRaw = await countByPosition();
  const applicationsByPosition: { position: string; count: number }[] = [];
  for (const entry of byPositionRaw) {
    let title = entry.position_id || "Unknown";
    if (entry.position_id && isValidObjectId(entry.position_id)) {
      const position = await getPosition({ _id: toObjectId(entry.position_id)! });
      if (position) title = position.title;
    }
    applicationsByPosition.push({ position: title, count: entry.count });
  }

  const pipelineBreakdown = Object.entries(statusCounts).map(([stage, count]) => ({ stage, count }));

  return {
    totals: {
      total_applications: totalApplications,
      new_this_week: newThisWeek,
      shortlisted: statusCounts.shortlisted ?? 0,
      interviews_scheduled: statusCounts.interview ?? 0,
      offers_extended: statusCounts.offered ?? 0,
      acceptance_rate: acceptanceRate,
      avg_time_to_hire_days: avgDays,
      open_positions: positionStatusCounts.open ?? 0,
    },
    weekly_applications: weekly,
    pipeline_breakdown: pipelineBreakdown,
    applications_by_position: applicationsByPosition,
    generated_at: nowSeconds(),
  };
}

export async function getOverviewMetrics(forceRefresh = false): Promise<Record<string, unknown>> {
  if (!forceRefresh) {
    const cached = cacheGet<Record<string, unknown>>(DASHBOARD_CACHE_KEY);
    if (cached) return cached;
  }
  const payload = await computeOverviewMetrics();
  cacheSet(DASHBOARD_CACHE_KEY, payload, DASHBOARD_CACHE_TTL);
  return payload;
}

export async function warmDashboardCache(): Promise<void> {
  await getOverviewMetrics(true);
}
