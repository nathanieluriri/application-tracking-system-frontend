import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import {
  addEmailTemplate,
  retrieveEmailTemplateById,
  retrieveEmailTemplates,
  updateEmailTemplateById,
  removeEmailTemplate,
} from "@server/services/email-templates";

const base = { name: "Interview Invite", subject: "You're invited", html_body: "<p>Hi</p>" };

describe("email-template service", () => {
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

  it("creates, fetches, updates and deletes a template", async () => {
    const created = await addEmailTemplate(base, newId());
    expect(created.id).toBeTruthy();
    expect(created.type).toBe("custom");

    const fetched = await retrieveEmailTemplateById(created.id!);
    expect(fetched.name).toBe("Interview Invite");

    const updated = await updateEmailTemplateById(created.id!, { subject: "Updated" });
    expect(updated.subject).toBe("Updated");

    expect((await removeEmailTemplate(created.id!)).deleted).toBe(true);
    await expect(retrieveEmailTemplateById(created.id!)).rejects.toMatchObject({ status: 404 });
  });

  it("lists templates", async () => {
    await addEmailTemplate(base, newId());
    await addEmailTemplate({ ...base, name: "Rejection", type: "rejection" }, newId());
    expect(await retrieveEmailTemplates()).toHaveLength(2);
  });

  it("refuses to delete a system template", async () => {
    const sys = await addEmailTemplate({ ...base, is_system: true }, newId());
    await expect(removeEmailTemplate(sys.id!)).rejects.toMatchObject({ status: 404 });
  });
});
