import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as meGET } from "@/app/api/auth/me/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";

const ctx = { params: Promise.resolve({}) };

const signup = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "pw123456",
};

function jsonReq(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("auth route handlers", () => {
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

  it("signup sets cookies, hides tokens in body, and /me then works", async () => {
    const signupRes = await signupPOST(jsonReq("http://x/api/auth/signup", signup), ctx);
    expect(signupRes.status).toBe(201);
    const access = signupRes.cookies.get("access_token")?.value;
    expect(access).toBeTruthy();

    const signupBody = await signupRes.json();
    expect(signupBody.success).toBe(true);
    expect(signupBody.data.email).toBe(signup.email);
    expect(signupBody.data.access_token).toBeNull(); // tokens only in cookies

    const meRes = await meGET(
      new Request("http://x/api/auth/me", { headers: { cookie: `access_token=${access}` } }),
      ctx,
    );
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.data.email).toBe(signup.email);
  });

  it("login returns 200 + cookies and rejects bad credentials with 401", async () => {
    await signupPOST(jsonReq("http://x/api/auth/signup", signup), ctx);

    const okRes = await loginPOST(
      jsonReq("http://x/api/auth/login", { email: signup.email, password: signup.password }),
      ctx,
    );
    expect(okRes.status).toBe(200);
    expect(okRes.cookies.get("access_token")?.value).toBeTruthy();

    const badRes = await loginPOST(
      jsonReq("http://x/api/auth/login", { email: signup.email, password: "nope" }),
      ctx,
    );
    expect(badRes.status).toBe(401);
    const badBody = await badRes.json();
    expect(badBody.success).toBe(false);
  });

  it("logout clears the auth cookies", async () => {
    const res = await logoutPOST(new Request("http://x/api/auth/logout", { method: "POST" }), ctx);
    expect(res.status).toBe(200);
    expect(res.cookies.get("access_token")?.value).toBe("");
  });

  it("rejects an invalid signup body with 422", async () => {
    const res = await signupPOST(jsonReq("http://x/api/auth/signup", { email: "x" }), ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.data.code).toBe("VALIDATION_FAILED");
  });
});
