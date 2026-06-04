import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { POST as createPOST } from "@/app/api/positions/route";
import { GET as publicGET } from "@/app/api/positions/public/route";
import { addAdmin } from "@server/services/admins";
import { addPosition } from "@server/services/positions";
import { newId } from "../helpers/fixtures";
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

describe("position route handlers", () => {
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

  it("lets an authenticated admin create a position", async () => {
    const cookie = await adminCookie();
    const req = new Request("http://x/api/positions", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ title: "Engineer" }),
    });
    const res = await createPOST(req, ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe("Engineer");
    expect(body.data.created_by).toBeTruthy();
  });

  it("rejects an unauthenticated create with 401", async () => {
    const req = new Request("http://x/api/positions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "X" }),
    });
    const res = await createPOST(req, ctx);
    expect(res.status).toBe(401);
  });

  it("serves the public open-positions list without auth", async () => {
    await addPosition({ title: "Open", employment_type: "full_time", status: "open" }, newId());
    await addPosition({ title: "Closed", employment_type: "full_time", status: "closed" }, newId());
    const res = await publicGET(new Request("http://x/api/positions/public"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].status).toBe("open");
  });
});
