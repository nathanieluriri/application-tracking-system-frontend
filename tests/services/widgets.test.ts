import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import {
  addWidget,
  retrieveWidgetById,
  retrieveWidgets,
  updateWidgetById,
  removeWidget,
  duplicateWidget,
  retrieveWidgetPublicData,
} from "@server/services/widgets";
import { addPosition } from "@server/services/positions";

describe("widget service", () => {
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

  it("creates, fetches, updates, duplicates, and deletes a widget", async () => {
    const created = await addWidget({ name: "Careers" }, newId());
    expect(created.id).toBeTruthy();
    expect(created.layout).toBe("list");

    const fetched = await retrieveWidgetById(created.id!);
    expect(fetched.name).toBe("Careers");

    const updated = await updateWidgetById(created.id!, { layout: "grid", theme: { accent: "#abc" } });
    expect(updated.layout).toBe("grid");
    expect(updated.theme.accent).toBe("#abc");

    const dupe = await duplicateWidget(created.id!, newId());
    expect(dupe.name).toBe("Careers (copy)");
    expect(dupe.layout).toBe("grid"); // copies the (updated) config
    expect((await retrieveWidgets()).length).toBe(2);

    expect((await removeWidget(created.id!)).deleted).toBe(true);
    await expect(retrieveWidgetById(created.id!)).rejects.toMatchObject({ status: 404 });
  });

  it("400s on invalid id and 404s when missing", async () => {
    await expect(retrieveWidgetById("nope")).rejects.toMatchObject({ status: 400 });
    await expect(retrieveWidgetById(newId())).rejects.toMatchObject({ status: 404 });
  });

  it("public data returns the render config + filtered open roles", async () => {
    await addPosition({ title: "Eng", department: "Engineering", status: "open" }, newId());
    await addPosition({ title: "Design", department: "Design", status: "open" }, newId());
    await addPosition({ title: "Closed", status: "closed" }, newId());

    const w = await addWidget(
      { name: "Eng widget", filters: { departments: ["Engineering"], max_roles: 0 } },
      newId(),
    );
    const data = await retrieveWidgetPublicData(w.id!);
    expect((data.widget as any).id).toBe(w.id);
    expect((data.widget as any).created_by).toBeUndefined(); // render-safe subset
    expect((data.roles as any[]).map((r) => r.title)).toEqual(["Eng"]);
  });

  it("public data for a disabled widget returns an empty, flagged payload", async () => {
    const w = await addWidget({ name: "Off", status: "disabled" }, newId());
    const data = await retrieveWidgetPublicData(w.id!);
    expect(data.widget).toEqual({ status: "disabled" });
    expect(data.roles).toEqual([]);
  });
});
