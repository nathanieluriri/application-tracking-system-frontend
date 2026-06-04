import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { POST as createPOST, GET as listGET } from "@/app/api/widgets/route";
import { GET as publicGET, OPTIONS as publicOPTIONS } from "@/app/api/public/widgets/[id]/route";
import { addAdmin } from "@server/services/admins";
import { addWidget } from "@server/services/widgets";
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

describe("widget route handlers", () => {
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

  it("admin can create + list widgets; unauthenticated cannot", async () => {
    const cookie = await adminCookie();
    const res = await createPOST(
      new Request("http://x/api/widgets", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ name: "Careers" }),
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    expect((await res.json()).data.name).toBe("Careers");

    const anon = await createPOST(
      new Request("http://x/api/widgets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      }),
      ctx,
    );
    expect(anon.status).toBe(401);

    const list = await listGET(
      new Request("http://x/api/widgets", { headers: { cookie } }),
      ctx,
    );
    expect(list.status).toBe(200);
  });

  it("public data route is open (CORS) and 404s an unknown widget without auth", async () => {
    const opt = publicOPTIONS();
    expect(opt.status).toBe(204);
    expect(opt.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const res = await publicGET(new Request("http://x/api/public/widgets/x"), {
      params: Promise.resolve({ id: "000000000000000000000000" }),
    });
    expect(res.status).toBe(404); // not 401 — proves no auth gate
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("public data route serves an existing widget's payload", async () => {
    const w = await addWidget({ name: "W" }, newId());
    const res = await publicGET(new Request("http://x/api/public/widgets/x"), {
      params: Promise.resolve({ id: w.id! }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.widget.id).toBe(w.id);
    expect(Array.isArray(body.data.roles)).toBe(true);
  });
});
