import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { GET as listGET, POST as createPOST } from "@/app/api/application-processes/route";
import { addAdmin } from "@server/services/admins";
import { AccountStatus } from "@server/schemas/common";

const ctx = { params: Promise.resolve({}) };

async function adminCookie(): Promise<string> {
  const admin = await addAdmin({
    full_name: "Adm",
    email: `adm-${newId()}@x.com`,
    password: "pw123456",
    accountStatus: AccountStatus.ACTIVE,
    permissionList: null,
  });
  return `access_token=${admin.access_token}`;
}

const validBody = {
  name: "Standard Pipeline",
  stages: [{ key: "new", label: "New", order: 1 }],
};

describe("application-process route handlers", () => {
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

  it("lets an authenticated admin create a process and stamps created_by", async () => {
    const cookie = await adminCookie();
    const req = new Request("http://x/api/application-processes", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const res = await createPOST(req, ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("Standard Pipeline");
    expect(body.data.created_by).toBeTruthy();
  });

  it("rejects an unauthenticated create with 401", async () => {
    const req = new Request("http://x/api/application-processes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await createPOST(req, ctx);
    expect(res.status).toBe(401);
  });

  it("lists processes for an authenticated admin", async () => {
    const cookie = await adminCookie();
    await createPOST(
      new Request("http://x/api/application-processes", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(validBody),
      }),
      ctx,
    );

    const res = await listGET(
      new Request("http://x/api/application-processes", { headers: { cookie } }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Standard Pipeline");
  });

  it("rejects an unauthenticated list with 401", async () => {
    const res = await listGET(new Request("http://x/api/application-processes"), ctx);
    expect(res.status).toBe(401);
  });
});
