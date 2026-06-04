import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { POST as submitPOST, GET as listGET } from "@/app/api/applications/route";
import { addPosition } from "@server/services/positions";
import { addApplicationProcess } from "@server/services/application-process";
import { addAdmin } from "@server/services/admins";
import { AccountStatus } from "@server/schemas/common";

const ctx = { params: Promise.resolve({}) };

async function openPositionNoCv(): Promise<string> {
  const proc = await addApplicationProcess({
    name: "NoCV",
    stages: [{ key: "new", label: "New", order: 1 }],
    require_cv: false,
    auto_acknowledge: false,
  });
  const pos = await addPosition(
    { title: "Engineer", status: "open", process_template_id: proc.id! },
    newId(),
  );
  return pos.id!;
}

function submitReq(fields: Record<string, string>): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request("http://x/api/applications", { method: "POST", body: form });
}

describe("application route handlers", () => {
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

  it("silently accepts a honeypot submission without persisting", async () => {
    const res = await submitPOST(submitReq({ website: "bot", full_name: "x", email: "x@x.com", position_id: "y" }), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual({ submitted: true });
    expect(await db.collection("applications").countDocuments()).toBe(0);
  });

  it("accepts a valid public submission and creates an application", async () => {
    const positionId = await openPositionNoCv();
    const res = await submitPOST(
      submitReq({ full_name: "Ada Lovelace", email: "ada@example.com", position_id: positionId }),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.full_name).toBe("Ada Lovelace");
    expect(await db.collection("applications").countDocuments()).toBe(1);
  });

  it("422s a submission missing required fields", async () => {
    const res = await submitPOST(submitReq({ full_name: "Ada" }), ctx);
    expect(res.status).toBe(422);
  });

  it("requires admin auth to list applications", async () => {
    const res = await listGET(new Request("http://x/api/applications"), ctx);
    expect(res.status).toBe(401);

    const admin = await addAdmin({
      full_name: "Adm",
      email: `adm-${newId()}@x.com`,
      password: "pw123456",
      accountStatus: AccountStatus.ACTIVE,
      permissionList: null,
    });
    const okRes = await listGET(
      new Request("http://x/api/applications", {
        headers: { cookie: `access_token=${admin.access_token}` },
      }),
      ctx,
    );
    expect(okRes.status).toBe(200);
  });
});
