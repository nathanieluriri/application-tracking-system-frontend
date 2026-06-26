import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { addAdmin } from "@server/services/admins";
import { AccountStatus } from "@server/schemas/common";
import { POST as loginPOST } from "@/app/api/admins/login/route";
import { POST as logoutPOST } from "@/app/api/admins/logout/route";
import { GET as profileGET } from "@/app/api/admins/profile/route";
import { GET as listGET, POST as createPOST } from "@/app/api/admins/route";

const ctx = { params: Promise.resolve({}) };

const creds = { email: "boss@example.com", password: "pw123456" };

async function seedAdmin(email = creds.email): Promise<string> {
  const admin = await addAdmin({
    full_name: "Boss Admin",
    email,
    password: creds.password,
    accountStatus: AccountStatus.ACTIVE,
    permissionList: null,
  });
  return `access_token=${admin.access_token}`;
}

function jsonReq(url: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request(url, { method: "POST", body: JSON.stringify(body), headers });
}

describe("admin route handlers", () => {
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

  it("logs an existing admin in (200 + access_token cookie, tokens hidden in body)", async () => {
    await seedAdmin();
    const res = await loginPOST(jsonReq("http://x/api/admins/login", creds), ctx);
    expect(res.status).toBe(200);
    expect(res.cookies.get("access_token")?.value).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(creds.email);
    expect(body.data.access_token).toBeNull();
    expect(body.data.password).toBeNull();
  });

  it("rejects bad credentials with 401", async () => {
    await seedAdmin();
    const res = await loginPOST(
      jsonReq("http://x/api/admins/login", { email: creds.email, password: "nope" }),
      ctx,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("serves the admin profile when authenticated by cookie", async () => {
    const cookie = await seedAdmin();
    const res = await profileGET(
      new Request("http://x/api/admins/profile", { headers: { cookie } }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.email).toBe(creds.email);
  });

  it("rejects an unauthenticated profile request with 401", async () => {
    const res = await profileGET(new Request("http://x/api/admins/profile"), ctx);
    expect(res.status).toBe(401);
  });

  it("lists admins for an authenticated admin", async () => {
    const cookie = await seedAdmin();
    const res = await listGET(new Request("http://x/api/admins", { headers: { cookie } }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((a: { email: string }) => a.email === creds.email)).toBe(true);
  });

  it("requires admin auth to list (401 without a token)", async () => {
    const res = await listGET(new Request("http://x/api/admins"), ctx);
    expect(res.status).toBe(401);
  });

  it("lets an admin create another admin (201) without swapping the creator's session", async () => {
    const cookie = await seedAdmin();
    const newEmail = `invited-${newId()}@example.com`;
    const res = await createPOST(
      jsonReq(
        "http://x/api/admins",
        { full_name: "Invited", email: newEmail, password: "pw123456" },
        cookie,
      ),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.email).toBe(newEmail);
    expect(body.data.invited_by).toBeTruthy();
    // Creating an admin must NOT set auth cookies — otherwise the creating admin
    // would be silently logged into the freshly-created account. Tokens are also
    // hidden from the body.
    expect(res.cookies.get("access_token")?.value).toBeFalsy();
    expect(res.cookies.get("refresh_token")?.value).toBeFalsy();
    expect(body.data.access_token).toBeNull();

    // The new admin is a real, usable account (its password works).
    const loginRes = await loginPOST(
      jsonReq("http://x/api/admins/login", { email: newEmail, password: "pw123456" }),
      ctx,
    );
    expect(loginRes.status).toBe(200);
  });

  it("rejects an unauthenticated signup with 401", async () => {
    const res = await createPOST(
      jsonReq("http://x/api/admins", {
        full_name: "X",
        email: `x-${newId()}@example.com`,
        password: "pw123456",
      }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("logout clears the auth cookies", async () => {
    const res = await logoutPOST(
      new Request("http://x/api/admins/logout", { method: "POST" }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(res.cookies.get("access_token")?.value).toBe("");
  });
});
