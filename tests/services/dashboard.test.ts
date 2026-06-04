import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { cacheClear } from "@server/core/cache";
import { computeOverviewMetrics, getOverviewMetrics } from "@server/services/dashboard";
import { addPosition } from "@server/services/positions";
import { addApplicationProcess } from "@server/services/application-process";
import { submitApplication, updateApplicationStatus } from "@server/services/applications";

async function seedData(): Promise<void> {
  const proc = await addApplicationProcess({
    name: "NoCV",
    stages: [
      { key: "new", label: "New", order: 1 },
      { key: "accepted", label: "Accepted", order: 2 },
    ],
    require_cv: false,
    auto_acknowledge: false,
  });
  const pos = await addPosition(
    { title: "Engineer", status: "open", process_template_id: proc.id! },
    newId(),
  );
  const a = await submitApplication({ full_name: "A", email: "a@x.com", position_id: pos.id! });
  await updateApplicationStatus(a.id!, "accepted");
}

describe("dashboard service", () => {
  let db: Db;
  beforeAll(async () => {
    db = await startTestDb();
  });
  afterEach(async () => {
    await clearDb(db);
    cacheClear();
  });
  afterAll(async () => {
    await closeDb();
    await stopTestDb();
  });

  it("computes overview metrics from applications + positions", async () => {
    await seedData();
    const metrics = (await computeOverviewMetrics()) as any;
    expect(metrics.totals.total_applications).toBe(1);
    expect(metrics.totals.open_positions).toBe(1);
    expect(metrics.pipeline_breakdown.length).toBeGreaterThan(0);
    expect(metrics.weekly_applications).toHaveLength(5);
    expect(Array.isArray(metrics.applications_by_position)).toBe(true);
  });

  it("serves an empty-but-valid overview with no data", async () => {
    const metrics = (await getOverviewMetrics(true)) as any;
    expect(metrics.totals.total_applications).toBe(0);
    expect(metrics.totals.acceptance_rate).toBe(0);
  });
});
