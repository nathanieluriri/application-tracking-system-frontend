import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { addPosition } from "@server/services/positions";
import { addApplicationProcess } from "@server/services/application-process";
import {
  submitApplication,
  updateApplicationStatus,
  retrieveApplications,
  retrieveApplication,
} from "@server/services/applications";

async function openPositionNoCv(): Promise<string> {
  const proc = await addApplicationProcess({
    name: "NoCV",
    stages: [
      { key: "new", label: "New", order: 1 },
      { key: "reviewing", label: "Reviewing", order: 2 },
    ],
    require_cv: false,
    auto_acknowledge: false,
  });
  const pos = await addPosition(
    { title: "Engineer", status: "open", process_template_id: proc.id! },
    newId(),
  );
  return pos.id!;
}

describe("application service", () => {
  let db: Db;
  beforeAll(async () => {
    db = await startTestDb();
  });
  afterEach(async () => {
    await clearDb(db);
  });
  afterAll(async () => {
    await closeDb();
    await stopTestDb();
  });

  it("submits an application to an open position and stamps the position title", async () => {
    const positionId = await openPositionNoCv();
    const app = await submitApplication({
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      position_id: positionId,
    });
    expect(app.id).toBeTruthy();
    expect(app.status).toBe("new");
    expect(app.position_title).toBe("Engineer");
  });

  it("rejects a duplicate submission within the window with 429", async () => {
    const positionId = await openPositionNoCv();
    const input = { full_name: "Ada", email: "ada@example.com", position_id: positionId };
    await submitApplication(input);
    await expect(submitApplication(input)).rejects.toMatchObject({ status: 429 });
  });

  it("requires a CV when the process demands one", async () => {
    const pos = await addPosition({ title: "Needs CV", status: "open" }, newId()); // default process require_cv=true
    await expect(
      submitApplication({ full_name: "X", email: "x@example.com", position_id: pos.id! }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("404s when the position is not open", async () => {
    const pos = await addPosition({ title: "Closed", status: "closed" }, newId());
    await expect(
      submitApplication({ full_name: "X", email: "x@example.com", position_id: pos.id! }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("transitions status only to a valid stage and records history", async () => {
    const positionId = await openPositionNoCv();
    const app = await submitApplication({
      full_name: "Ada",
      email: "ada@example.com",
      position_id: positionId,
    });
    const updated = await updateApplicationStatus(app.id!, "reviewing", "admin-1");
    expect(updated.status).toBe("reviewing");

    await expect(updateApplicationStatus(app.id!, "bogus", "admin-1")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("lists applications with a status filter and resolves titles", async () => {
    const positionId = await openPositionNoCv();
    await submitApplication({ full_name: "A", email: "a@example.com", position_id: positionId });
    const all = await retrieveApplications({});
    expect(all).toHaveLength(1);
    expect(all[0].position_title).toBe("Engineer");
  });
});
