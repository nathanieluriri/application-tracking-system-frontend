import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { addPosition, retrievePublicPositionById } from "@server/services/positions";

describe("retrievePublicPositionById", () => {
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

  it("returns an open role", async () => {
    const p = await addPosition({ title: "Open role", status: "open" }, newId());
    const got = await retrievePublicPositionById(p.id!);
    expect(got.title).toBe("Open role");
  });

  it("404s a closed role (never leaks non-open roles)", async () => {
    const p = await addPosition({ title: "Closed role", status: "closed" }, newId());
    await expect(retrievePublicPositionById(p.id!)).rejects.toMatchObject({ status: 404 });
  });

  it("404s an unknown or malformed id", async () => {
    await expect(retrievePublicPositionById(newId())).rejects.toMatchObject({ status: 404 });
    await expect(retrievePublicPositionById("not-an-id")).rejects.toMatchObject({ status: 404 });
  });
});
