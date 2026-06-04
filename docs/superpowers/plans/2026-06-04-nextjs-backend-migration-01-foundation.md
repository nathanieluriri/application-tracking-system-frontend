# Next.js Backend Migration — Stage 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the framework-agnostic server foundation (core + security + http helpers + test infra) inside the Next.js app so later resource modules can be ported on top of it.

**Architecture:** A `src/server/` module mirrors the FastAPI layout (`core/`, `schemas/`, `repositories/`, `services/`, `security/`, `http/`). Layers below `http/` never import `next/*`, so they run directly under Vitest. Controllers (`app/api/**/route.ts`) wrap services with `withEnvelope`. MongoDB is the only external dependency; Redis/Celery/APScheduler are replaced by Mongo/in-process equivalents.

**Tech Stack:** Next.js 15 (App Router), TypeScript, MongoDB driver, `zod`, `jose` (JWT), `bcryptjs`, Vitest, `mongodb-memory-server`.

**Reference oracle:** `../application-tracking-system-backend/` (the FastAPI source). Behaviour parity is judged against it.

---

## File structure (this stage)

```
src/server/
  core/
    settings.ts            env → typed Settings
    errors.ts              AppError + ErrorCode
    response-envelope.ts   successEnvelope / errorEnvelope
    role-config.ts         normalizeRole + rate-limit rule table
    database.ts            shared MongoClient + getDb()
    queue/
      registry.ts          task registry (register/execute)
      provider.ts          JobProvider interface + InlineJobProvider
      manager.ts           QueueManager singleton
  schemas/
    tokens.ts              zod token schemas + types
  repositories/
    tokens.ts              accessToken / refreshToken collections
  security/
    hash.ts                bcrypt hash/verify
    jwt.ts                 jose sign/verify role tokens
    principal.ts           AuthPrincipal type + helpers
    tokens.ts              generate/validate/rotate token records
    cookies.ts             auth-cookie directives (framework-neutral)
    permissions.ts         permission-key derivation
    rate-limit.ts          Mongo fixed-window limiter
    auth.ts                extract+resolve principal, role checks
  http/
    request.ts             body/query/params/request-id helpers (Next-aware)
    with-envelope.ts       wrap handler result → NextResponse envelope
    guards.ts              requireUser / requireAdmin / optionalAuth (Next-aware)
tests/
  helpers/
    db.ts                  mongodb-memory-server lifecycle
    fixtures.ts            token/user factories
  core/ schemas/ repositories/ security/   (mirrors pytest layout)
vitest.config.ts
.env.local
.env.test
```

---

### Task 1: Project & test infrastructure

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `vitest.config.ts`
- Create: `.env.local`, `.env.test`
- Create: `tests/helpers/db.ts`
- Modify: `tsconfig.json` (path alias `@server/*`)

- [ ] **Step 1: Add dependencies**

Run:
```bash
bun add mongodb jose bcryptjs nodemailer
bun add -d vitest mongodb-memory-server @types/bcryptjs @types/nodemailer dotenv
```
(`zod` is already present. `stripe` / `@aws-sdk/client-s3` are added in their stage.)

- [ ] **Step 2: tsconfig path alias**

Add to `compilerOptions.paths` in `tsconfig.json` (keep the existing `@/*`):
```json
"@server/*": ["./src/server/*"]
```

- [ ] **Step 3: vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    hookTimeout: 60_000, // mongodb-memory-server first download
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@server": resolve(__dirname, "./src/server"),
      "@": resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: tests/helpers/setup.ts** (loads `.env.test`)

```ts
import { config } from "dotenv";
config({ path: ".env.test" });
```

- [ ] **Step 5: tests/helpers/db.ts**

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, Db } from "mongodb";

let mongod: MongoMemoryServer | null = null;
let client: MongoClient | null = null;

export async function startTestDb(): Promise<Db> {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.DB_NAME = "ats_test";
  client = new MongoClient(mongod.getUri());
  await client.connect();
  return client.db("ats_test");
}

export async function stopTestDb(): Promise<void> {
  await client?.close();
  await mongod?.stop();
  client = null;
  mongod = null;
}

export async function clearDb(db: Db): Promise<void> {
  const cols = await db.collections();
  await Promise.all(cols.map((c) => c.deleteMany({})));
}
```

- [ ] **Step 6: package.json scripts**

Add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: .env.local** (the runtime file requested by the user)

```
ENV=development
MONGODB_URI=mongodb://localhost:27017
DB_NAME=ats
SECRET_KEY=dev-insecure-secret-change-me-0a1b2c3d4e5f
SESSION_SECRET_KEY=dev-insecure-session-secret-change-me-9f8e7d6c
ACCESS_TOKEN_MAX_AGE_SECONDS=86400
REFRESH_TOKEN_MAX_AGE_SECONDS=2592000
ACCESS_TOKEN_TTL_DAYS=10
CORS_ORIGINS=http://localhost:3000
ROLE_RATE_LIMITS=anonymous:20/minute,user:80/minute,admin:140/minute
JOB_BACKEND=inline
STORAGE_BACKEND=local
STORAGE_LOCAL_ROOT=./.storage
EMAIL_TRANSPORT=console
EMAIL_FROM_EMAIL=no-reply@ats.local
EMAIL_SENDER_NAME=ATS
EMAIL_QUEUE_ENABLED=true
PAYMENT_DEFAULT_PROVIDER=stripe
NEXT_PUBLIC_APP_NAME=ATS
# Optional integrations (blank ⇒ dev/stub mode):
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# FLUTTERWAVE_SECRET_KEY=
# FLUTTERWAVE_WEBHOOK_SECRET_HASH=
# S3_BUCKET_NAME=
# S3_REGION=
# S3_ENDPOINT_URL=
# EMAIL_HOST=
# EMAIL_PORT=587
# EMAIL_USERNAME=
# EMAIL_PASSWORD=
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

`.env.test` = same but `ENV=test`, `SECRET_KEY=test-secret`, `EMAIL_TRANSPORT=console`, `MONGODB_URI` overridden at runtime by the memory server.

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock vitest.config.ts tsconfig.json .env.local .env.test tests/helpers
git commit -m "chore: test infra + deps + env for backend migration"
```

---

### Task 2: `core/settings.ts`

Mirrors `core/settings.py`. Pure function `getSettings()` reading `process.env`, memoized.

**Files:** Create `src/server/core/settings.ts`; Test `tests/core/settings.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadSettings } from "@server/core/settings";

describe("settings", () => {
  it("parses CSV and booleans and applies defaults", () => {
    const s = loadSettings({
      ENV: "production",
      CORS_ORIGINS: "http://a.com, http://b.com",
      EMAIL_QUEUE_ENABLED: "true",
      DEBUG_INCLUDE_ERROR_DETAILS: "false",
    } as NodeJS.ProcessEnv);
    expect(s.isProduction).toBe(true);
    expect(s.corsOrigins).toEqual(["http://a.com", "http://b.com"]);
    expect(s.emailQueueEnabled).toBe(true);
    expect(s.emailSenderName).toBe("ATS"); // default when unset differs; assert real default
  });
});
```

- [ ] **Step 2: Run → fail** (`bun run test tests/core/settings.test.ts`) — module missing.

- [ ] **Step 3: Implement** `loadSettings(env = process.env)` returning a frozen object with fields from spec §2/§10: `env`, `isProduction`, `secretKey`, `sessionSecretKey`, `corsOrigins: string[]`, `accessTokenMaxAge`, `refreshTokenMaxAge`, `accessTokenTtlDays`, email fields, `storageBackend`, `storageLocalRoot`, `s3*`, `paymentDefaultProvider`, `stripe*`, `flutterwave*`, `jobBackend`, `emailTransport`, `roleRateLimits` (raw string), `debugIncludeErrorDetails`. Add memoized `getSettings()` that calls `loadSettings()` once. Helpers `splitCsv`, `asBool`, `asInt`.

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat(core): typed settings loader`.

---

### Task 3: `core/errors.ts`

Mirrors `core/errors.py`. `ErrorCode` enum + `AppError` + helper constructors.

**Files:** Create `src/server/core/errors.ts`; Test `tests/core/errors.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { AppError, ErrorCode, resourceNotFound } from "@server/core/errors";

it("carries status, code, message, details", () => {
  const e = new AppError({ status: 403, code: ErrorCode.AUTH_PERMISSION_DENIED, message: "no", details: { k: 1 } });
  expect(e.status).toBe(403);
  expect(e.code).toBe("AUTH_PERMISSION_DENIED");
  expect(e.details).toEqual({ k: 1 });
});
it("resourceNotFound helper", () => {
  const e = resourceNotFound("Application", "abc");
  expect(e.status).toBe(404);
  expect(e.details).toMatchObject({ resource: "Application", resource_id: "abc" });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `ErrorCode` (all values from `core/errors.py`: `AUTH_INVALID_TOKEN`, `AUTH_ROLE_MISMATCH`, `AUTH_ACCOUNT_INACTIVE`, `AUTH_PERMISSION_DENIED`, `AUTH_PRINCIPAL_NOT_FOUND`, `RESOURCE_NOT_FOUND`, `VALIDATION_FAILED`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`, `PAYMENT_PROVIDER_ERROR`, `PAYMENT_WEBHOOK_INVALID`, `DOCUMENT_UPLOAD_INVALID`); `class AppError extends Error` with `status/code/details/headers`; helpers `authInvalidToken`, `authRoleMismatch`, `authPermissionDenied`, `resourceNotFound`.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(core): AppError and ErrorCode`.

---

### Task 4: `core/response-envelope.ts`

Mirrors `core/response_envelope.py` (the non-FastAPI parts). Ports `tests/test_response_envelope.py`.

**Files:** Create `src/server/core/response-envelope.ts`; Test `tests/core/response-envelope.test.ts`.

- [ ] **Step 1: Failing test** — assert envelope shape:

```ts
import { successEnvelope, errorEnvelope } from "@server/core/response-envelope";

it("success envelope", () => {
  expect(successEnvelope({ a: 1 }, "ok", { meta: { page: 1 }, requestId: "r1" })).toEqual({
    success: true, message: "ok", data: { a: 1 }, meta: { page: 1 }, requestId: "r1",
  });
});
it("omits meta/requestId when absent", () => {
  expect(successEnvelope([], "ok")).toEqual({ success: true, message: "ok", data: [] });
});
it("error envelope", () => {
  expect(errorEnvelope("bad", { code: "X", details: null })).toEqual({
    success: false, message: "bad", data: { code: "X", details: null },
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `successEnvelope(data, message, opts?)` and `errorEnvelope(message, data?, opts?)` exactly matching `success_payload`/`error_payload` (only include `meta`/`requestId` keys when provided/truthy).
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(core): response envelope`.

---

### Task 5: `core/role-config.ts`

Mirrors `core/role_config.py`. Ports `tests/test_role_config.py`.

**Files:** Create `src/server/core/role-config.ts`; Test `tests/core/role-config.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { normalizeRole, parseRoleRateLimits, buildRoleRateLimits } from "@server/core/role-config";

it("normalizes legacy member→user and blanks→anonymous", () => {
  expect(normalizeRole("member")).toBe("user");
  expect(normalizeRole("")).toBe("anonymous");
  expect(normalizeRole("ADMIN")).toBe("admin");
});
it("parses csv rules", () => {
  expect(parseRoleRateLimits("anonymous:20/minute,admin:140/minute")).toEqual({
    anonymous: "20/minute", admin: "140/minute",
  });
});
it("always includes anonymous + admin defaults", () => {
  const r = buildRoleRateLimits(null, "user:80/minute");
  expect(r.anonymous).toBeDefined();
  expect(r.admin).toBeDefined();
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `normalizeRole`, `parseRoleRateLimits`, `buildRoleRateLimitsCsv`, `buildRoleRateLimits`. Represent a parsed rate rule as `{ amount: number, windowSeconds: number }` (parse `"20/minute"` → `{amount:20, windowSeconds:60}`; support second/minute/hour/day). Defaults: anonymous `20/minute`, role `80/minute`, admin `140/minute`.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(core): role config + rate-rule parsing`.

---

### Task 6: `core/database.ts`

Single shared `MongoClient`, `getDb()`. Async, like motor usage.

**Files:** Create `src/server/core/database.ts`; Test `tests/core/database.test.ts`.

- [ ] **Step 1: Failing test** (uses memory server)

```ts
import { startTestDb, stopTestDb } from "../helpers/db";
import { getDb, closeDb } from "@server/core/database";

beforeAll(async () => { await startTestDb(); });
afterAll(async () => { await stopTestDb(); await closeDb(); });

it("connects and round-trips a doc", async () => {
  const db = await getDb();
  await db.collection("ping").insertOne({ ok: 1 });
  expect(await db.collection("ping").countDocuments()).toBe(1);
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** lazy singleton: `getClient()` connects once using `process.env.MONGODB_URI`; `getDb()` returns `client.db(process.env.DB_NAME)`; `closeDb()` for teardown. Cache the promise so concurrent calls share one connection. Also export `collections` helper names as constants (`COLLECTIONS = { applications, accessToken, refreshToken, users, admins, ... }`).
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(core): mongo client singleton`.

---

### Task 7: `core/queue` (registry + inline provider + manager)

Mirrors `core/queue/tasks.py` + `QueueManager`. Ports `tests/test_queue_registry.py`.

**Files:** Create `src/server/core/queue/registry.ts`, `provider.ts`, `manager.ts`; Test `tests/core/queue-registry.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { registerTask, executeRegisteredTask, listRegisteredTaskKeys, clearRegistry } from "@server/core/queue/registry";

beforeEach(() => clearRegistry());
it("registers and executes by key", async () => {
  registerTask("greet", async ({ name }: { name: string }) => `hi ${name}`);
  expect(await executeRegisteredTask("greet", { name: "x" })).toBe("hi x");
  expect(listRegisteredTaskKeys()).toEqual(["greet"]);
});
it("throws on duplicate key", () => {
  registerTask("dup", async () => 1);
  expect(() => registerTask("dup", async () => 2)).toThrow(/already registered/);
});
it("throws on unknown key", async () => {
  await expect(executeRegisteredTask("nope", {})).rejects.toThrow(/not registered/);
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** registry (`registerTask`, `task()` decorator-style helper, `executeRegisteredTask`, `listRegisteredTaskKeys`, `clearRegistry` for tests). `provider.ts`: `interface JobProvider { enqueue(key, payload): void | Promise<void> }`; `InlineJobProvider` runs `executeRegisteredTask` immediately and, in request context, `.catch(logErr)`. `manager.ts`: `QueueManager` singleton with `configure(provider)`, `getInstance()`, `enqueue(key,payload)`. Default to `InlineJobProvider`.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(core): task registry + inline queue`.

---

### Task 8: `security/hash.ts`

Mirrors `security/hash.py`.

**Files:** Create `src/server/security/hash.ts`; Test `tests/security/hash.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { hashPassword, checkPassword } from "@server/security/hash";
it("hashes and verifies", async () => {
  const h = await hashPassword("s3cret");
  expect(h).not.toBe("s3cret");
  expect(await checkPassword("s3cret", h)).toBe(true);
  expect(await checkPassword("wrong", h)).toBe(false);
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `hashPassword(pw): Promise<string>` and `checkPassword(pw, hash): Promise<boolean>` using `bcryptjs` (async `hash`/`compare`, 12 rounds). Accept string hash (bcrypt strings are storage-compatible with the Python `bcrypt` output).
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(security): bcrypt hashing`.

---

### Task 9: `security/jwt.ts`

Mirrors the cookie-JWT half of `security/encrypting_jwt.py` (`create_jwt_role_token` / `decode_jwt_token` / `decode_jwt_token_without_expiration`). Uses `jose`, HS256, `SECRET_KEY`.

**Files:** Create `src/server/security/jwt.ts`; Test `tests/security/jwt.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { signRoleToken, decodeToken, decodeTokenAllowExpired } from "@server/security/jwt";

it("round-trips claims", async () => {
  const jwt = await signRoleToken({ accessToken: "rec1", userId: "u1", role: "admin" });
  const d = await decodeToken(jwt);
  expect(d).toMatchObject({ accessToken: "rec1", userId: "u1", role: "admin" });
});
it("returns null for tampered token", async () => {
  expect(await decodeToken("not.a.jwt")).toBeNull();
});
it("decodeTokenAllowExpired still reads an expired token", async () => {
  const jwt = await signRoleToken({ accessToken: "r", userId: "u", role: "user" }, { expiresIn: "-1s" });
  expect(await decodeToken(jwt)).toBeNull();
  expect(await decodeTokenAllowExpired(jwt)).toMatchObject({ userId: "u" });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** with `jose`: payload `{ accessToken, role, userId }`, default `expiresIn` 15m (matches Python). `decodeToken` returns claims or `null` on any failure; `decodeTokenAllowExpired` retries ignoring `exp` (`jwtVerify` with `clockTolerance`/manual exp skip). Secret from `getSettings().secretKey`.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(security): jose JWT role tokens`.

---

### Task 10: `schemas/tokens.ts`

Mirrors `schemas/tokens_schema.py`. zod schemas + inferred types for access/refresh token records.

**Files:** Create `src/server/schemas/tokens.ts`; Test `tests/schemas/tokens.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { accessTokenOut } from "@server/schemas/tokens";
it("maps _id to accesstoken string", () => {
  const t = accessTokenOut({ _id: "abc123", userId: "u1", role: "member", dateCreated: 1 });
  expect(t.accesstoken).toBe("abc123");
  expect(t.userId).toBe("u1");
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `accessTokenCreate`, `accessTokenOut` (a normalizer fn that maps `_id`→`accesstoken`, defaults `role:"anonymous"`), `refreshTokenCreate`, `refreshTokenOut` (`_id`→`refreshtoken`). Export inferred TS types. Mongo `_id` accepted as `ObjectId | string` and stringified.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(schemas): token schemas`.

---

### Task 11: `repositories/tokens.ts`

Mirrors `repositories/tokens_repo.py` (the parts foundation needs): create access/refresh records, resolve+fetch with expiry + admin-status rules, delete by user.

**Files:** Create `src/server/repositories/tokens.ts`; Test `tests/repositories/tokens.test.ts`.

- [ ] **Step 1: Failing test** (memory mongo + real JWT)

```ts
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { getDb, closeDb } from "@server/core/database";
import { addAccessToken, getAccessToken, getAccessTokenAllowExpired, deleteAllTokensForUser } from "@server/repositories/tokens";
import { signRoleToken } from "@server/security/jwt";

let db;
beforeAll(async () => { db = await startTestDb(); });
afterEach(async () => { await clearDb(db); });
afterAll(async () => { await stopTestDb(); await closeDb(); });

it("creates a member access record and resolves it from a JWT", async () => {
  const rec = await addAccessToken("user-1");          // role member
  const jwt = await signRoleToken({ accessToken: rec.accesstoken!, userId: "user-1", role: "user" });
  const resolved = await getAccessToken(jwt);
  expect(resolved?.userId).toBe("user-1");
});
it("rejects records older than TTL unless allow-expired", async () => {
  const rec = await addAccessToken("user-2");
  await getDb().then(d => d.collection("accessToken").updateOne(
    { _id: toId(rec.accesstoken!) }, { $set: { dateCreated: 0 } }));
  const jwt = await signRoleToken({ accessToken: rec.accesstoken!, userId: "user-2", role: "user" });
  expect(await getAccessToken(jwt)).toBeNull();
  expect(await getAccessTokenAllowExpired(jwt)).not.toBeNull();
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** against collections `accessToken`/`refreshToken`. `addAccessToken(userId)` inserts `{ userId, role:"member", dateCreated: now }`; `addAdminAccessToken` inserts `{ ..., role:"admin", status:"active" }`; `addRefreshToken(userId, previousAccessToken)`. `resolveAccessTokenId(jwtOrId, allowExpired)` = decode JWT → `accessToken` claim, else treat as raw ObjectId. `getAccessToken(jwt, {allowExpired})`: resolve id → find record → if not allowExpired and `isOlderThanDays(dateCreated, settings.accessTokenTtlDays)` delete+null → if `role==="admin" && status!=="active"` null → return normalized. `getAccessTokenAllowExpired`. `deleteAccessToken(id)`, `deleteAllTokensForUser(userId)`, `getRefreshToken(id)`. Provide `toId()` (ObjectId) test helper in fixtures.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(repo): token repository`.

---

### Task 12: `security/tokens.ts`

Mirrors `security/tokens.py`: mint member/admin access tokens (record → JWT), refresh-token issuance/rotation.

**Files:** Create `src/server/security/tokens.ts`; Test `tests/security/tokens.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { generateMemberAccessToken, generateAdminAccessToken } from "@server/security/tokens";
it("mints a member access token whose JWT resolves back to the user", async () => {
  const out = await generateMemberAccessToken("u-1");
  expect(typeof out.accesstoken).toBe("string");       // JWT string
  expect(out.accesstoken!.split(".").length).toBe(3);
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `generateMemberAccessToken(userId)`: `addAccessToken` → `signRoleToken({accessToken: rec.accesstoken, userId, role:"user"})`; set `out.accesstoken = jwt`. `generateAdminAccessToken` analog with `addAdminAccessToken` + role admin. `generateRefreshToken(userId, accessJwt)`: decode access JWT → `addRefreshToken(userId, claim.accessToken)`; refresh cookie value = record `_id`. `validateRefreshToken(refreshId)`: load record → rotate (new refresh). Validate ObjectId inputs → throw `AppError(401)`.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(security): token generation + refresh rotation`.

---

### Task 13: `security/principal.ts`

Mirrors `security/principal.py`.

**Files:** Create `src/server/security/principal.ts`; Test `tests/security/principal.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { makePrincipal } from "@server/security/principal";
it("derives role booleans", () => {
  const p = makePrincipal({ userId: "u", role: "admin", accessTokenId: "a", jwtToken: "j" });
  expect(p.isAdmin).toBe(true);
  expect(p.isUser).toBe(false);
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `AuthPrincipal` type `{ userId; role: "user"|"admin"; accessTokenId; jwtToken; allowExpired }` + `makePrincipal()` returning it with `isAdmin/isUser` getters (or computed booleans).
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(security): auth principal`.

---

### Task 14: `security/auth.ts`

Mirrors `security/auth.py`: extract JWT (Bearer header or `access_token` cookie), resolve principal, role guards. Framework-neutral — takes a plain `{ authorization?: string; accessTokenCookie?: string }`.

**Files:** Create `src/server/security/auth.ts`; Test `tests/security/auth.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { resolvePrincipal, AuthInput } from "@server/security/auth";
import { generateMemberAccessToken } from "@server/security/tokens";
// (memory db in beforeAll as in Task 11)
it("resolves a user principal from a cookie token", async () => {
  const out = await generateMemberAccessToken("u-9");
  const p = await resolvePrincipal({ accessTokenCookie: out.accesstoken! }, { requireRole: "user" });
  expect(p.userId).toBe("u-9");
  expect(p.role).toBe("user");
});
it("throws AUTH_INVALID_TOKEN when no token", async () => {
  await expect(resolvePrincipal({}, {})).rejects.toMatchObject({ code: "AUTH_INVALID_TOKEN" });
});
it("throws AUTH_ROLE_MISMATCH for wrong role", async () => {
  const out = await generateMemberAccessToken("u-10");
  await expect(resolvePrincipal({ accessTokenCookie: out.accesstoken! }, { requireRole: "admin" }))
    .rejects.toMatchObject({ code: "AUTH_ROLE_MISMATCH" });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `extractJwt(input)` (Bearer wins, else cookie, else throw `authInvalidToken`), `resolvePrincipal(input, { requireRole?, allowExpired? })` → `getAccessToken(jwt, {allowExpired})` → normalize role (member→user) → assert in `("user","admin")` → optional `requireRole` check (`authRoleMismatch`) → `makePrincipal`. Export thin wrappers `verifyUser`, `verifyAdmin`, `verifyAny`, `verifyForRefresh` (allowExpired).
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(security): principal resolution + role guards`.

---

### Task 15: `security/cookies.ts`

Mirrors `security/cookies.py` but framework-neutral: returns cookie option objects the controller applies to a `NextResponse`.

**Files:** Create `src/server/security/cookies.ts`; Test `tests/security/cookies.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { authCookieDirectives, clearAuthCookieDirectives, ACCESS_COOKIE } from "@server/security/cookies";
it("builds httpOnly lax cookies with env max-age", () => {
  const [access] = authCookieDirectives("a", "r");
  expect(access).toMatchObject({ name: ACCESS_COOKIE, httpOnly: true, sameSite: "lax", path: "/" });
  expect(access.maxAge).toBe(86400);
});
it("clear sets maxAge 0", () => {
  expect(clearAuthCookieDirectives()[0].maxAge).toBe(0);
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** constants `ACCESS_COOKIE="access_token"`, `REFRESH_COOKIE="refresh_token"`, `RETURN_TOKENS_HEADER="X-Return-Tokens"`. `authCookieDirectives(access?, refresh?)` → array of `{ name, value, maxAge, httpOnly:true, secure: isProduction, sameSite:"lax", path:"/" }` (skip undefined). `clearAuthCookieDirectives()`. `shouldReturnTokens(headerValue)`.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(security): auth cookie directives`.

---

### Task 16: `security/permissions.ts`

Mirrors `security/permissions.py`: derive a permission key `METHOD:/normalized/path`.

**Files:** Create `src/server/security/permissions.ts`; Test `tests/security/permissions.test.ts` (ports `tests/test_permissions.py`).

- [ ] **Step 1: Failing test**

```ts
import { makePermissionKey } from "@server/security/permissions";
it("normalizes path and uppercases method", () => {
  expect(makePermissionKey("get", "/v1/applications/")).toBe("GET:/v1/applications");
  expect(makePermissionKey("POST", "applications//bulk/")).toBe("POST:/applications/bulk");
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `makePermissionKey(method, path)` (strip/collapse slashes, leading `/`, uppercase method). Plus `hasPermission(permissionList, { key, name, method })` mirroring `_has_permission` (key match OR legacy name+method).
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(security): permission keys`.

---

### Task 17: `security/rate-limit.ts`

Mongo fixed-window limiter replacing the Redis `limits` lib.

**Files:** Create `src/server/security/rate-limit.ts`; Test `tests/security/rate-limit.test.ts`.

- [ ] **Step 1: Failing test** (memory mongo)

```ts
import { hitRateLimit } from "@server/security/rate-limit";
// db started in beforeAll
it("allows up to amount then blocks within the window", async () => {
  const rule = { amount: 2, windowSeconds: 60 };
  expect((await hitRateLimit("k1", rule)).allowed).toBe(true);
  expect((await hitRateLimit("k1", rule)).allowed).toBe(true);
  const third = await hitRateLimit("k1", rule);
  expect(third.allowed).toBe(false);
  expect(third.remaining).toBe(0);
  expect(third.retryAfterSeconds).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** collection `rate_limits` keyed by `{ id, windowStart }`; atomic `$inc` via `findOneAndUpdate(upsert)`; TTL index on `expiresAt`. `hitRateLimit(id, rule)` returns `{ allowed, remaining, retryAfterSeconds, limit }`. Window = `floor(now/windowSeconds)`. Idempotent index creation.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(security): mongo fixed-window rate limit`.

---

### Task 18: `http/request.ts`

Next-aware request helpers.

**Files:** Create `src/server/http/request.ts`; Test `tests/http/request.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { authInputFromRequest, getRequestId } from "@server/http/request";
it("reads bearer and cookie", () => {
  const req = new Request("http://x", { headers: { authorization: "Bearer abc", cookie: "access_token=ck" } });
  const input = authInputFromRequest(req as any);
  expect(input.authorization).toBe("Bearer abc");
  expect(input.accessTokenCookie).toBe("ck");
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `authInputFromRequest(req)` (reads `authorization` header + parses `access_token`/`refresh_token` from cookie header), `getRequestId(req)` (header `x-request-id` or generated `crypto.randomUUID()`), `parseJsonBody<T>(req, zodSchema)` → validates or throws `AppError(422, VALIDATION_FAILED, { errors })`, `parseQuery(req, zodSchema)`.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(http): request helpers`.

---

### Task 19: `http/with-envelope.ts`

Wrap a handler's return value into a `NextResponse` envelope; map `AppError`/`ZodError`/unknown to error envelopes. Mirrors `@document_response` + the FastAPI exception handlers.

**Files:** Create `src/server/http/with-envelope.ts`; Test `tests/http/with-envelope.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { withEnvelope } from "@server/http/with-envelope";
import { AppError, ErrorCode } from "@server/core/errors";

it("wraps success", async () => {
  const handler = withEnvelope(async () => ({ a: 1 }), { message: "ok", status: 200 });
  const res = await handler(new Request("http://x") as any, { params: Promise.resolve({}) });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ success: true, message: "ok", data: { a: 1 } });
});
it("maps AppError to envelope", async () => {
  const handler = withEnvelope(async () => { throw new AppError({ status: 404, code: ErrorCode.RESOURCE_NOT_FOUND, message: "nf" }); });
  const res = await handler(new Request("http://x") as any, { params: Promise.resolve({}) });
  expect(res.status).toBe(404);
  expect(await res.json()).toMatchObject({ success: false, message: "nf", data: { code: "RESOURCE_NOT_FOUND" } });
});
it("maps ZodError to 422 VALIDATION_FAILED", async () => { /* throw z.parse failure → assert 422 + code */ });
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `withEnvelope(handler, opts?) => (req, ctx) => NextResponse`. On success: `successEnvelope(result, opts.message)` with `opts.status ?? 200`, attach `X-Request-ID`. Support `result` being a `NextResponse` already (pass through — for cookie-setting handlers). On `AppError`: status/code/message/details; on `ZodError`: 422 `VALIDATION_FAILED` `{ errors }`; else 500 `INTERNAL_ERROR` (details only when `debugIncludeErrorDetails && !isProduction`).
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(http): withEnvelope wrapper`.

---

### Task 20: `http/guards.ts`

Next-aware auth guards composing `security/auth` with the request.

**Files:** Create `src/server/http/guards.ts`; Test `tests/http/guards.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { requireUser, requireAdmin } from "@server/http/guards";
import { generateMemberAccessToken } from "@server/security/tokens";
// memory db in beforeAll
it("requireUser returns principal from cookie", async () => {
  const out = await generateMemberAccessToken("u-77");
  const req = new Request("http://x", { headers: { cookie: `access_token=${out.accesstoken}` } });
  const p = await requireUser(req as any);
  expect(p.userId).toBe("u-77");
});
it("requireAdmin throws for a user token", async () => {
  const out = await generateMemberAccessToken("u-78");
  const req = new Request("http://x", { headers: { cookie: `access_token=${out.accesstoken}` } });
  await expect(requireAdmin(req as any)).rejects.toMatchObject({ code: "AUTH_ROLE_MISMATCH" });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `requireUser(req)`, `requireAdmin(req)`, `requireAny(req)`, `optionalAuth(req)` using `authInputFromRequest` + `resolvePrincipal`. (Account-status + permission enforcement layer is added in Stage 2 when user/admin repositories exist; guards here cover role-level auth.)
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(http): auth guards`.

---

### Task 21: Health route + smoke wiring

Prove the foundation serves an envelope from a real route handler.

**Files:** Create `src/app/api/health/route.ts`; Test `tests/http/health.test.ts` (unit-call the handler).

- [ ] **Step 1: Failing test** — import the route's `GET`, call it, assert `{ success:true, data.status }`.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `GET = withEnvelope(async () => ({ status: "healthy", services: { mongo: await pingMongo() } }), { message: "Health check completed" })`. `pingMongo` runs `db.command({ ping: 1 })` and reports healthy/unhealthy without throwing.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(api): health route on Next foundation`.

---

## Stage-1 self-review checklist (run before handing off to Stage 2)

- [ ] `bun run test` green; `bunx tsc --noEmit` clean.
- [ ] Envelope/cookie/JWT/role contracts match the FastAPI source (spec §2/§7).
- [ ] No layer below `http/` imports `next/*` (grep check).
- [ ] `.env.local` boots the app with only Mongo (manual `bun dev` + `GET /api/health`).
- [ ] Ported tests (`response-envelope`, `role-config`, `permissions`, `queue-registry`) pass.

## Coverage map (spec → tasks)

- Settings §10 → Task 2 · Errors §2 → Task 3 · Envelope §2/§7 → Task 4/19 · Roles/rate rules §6 → Task 5/17 · Mongo §3 → Task 6 · Jobs §6 → Task 7 · Hash/JWT/tokens/principal/cookies/auth §7 → Tasks 8–15 · Permissions §5 → Task 16 · Request/guards §3 → Tasks 18–20 · Health §5 → Task 21.

## Next stages (separate plans, authored just-in-time)

- **Stage 2:** auth (users+admins), applications, positions — end-to-end controllers + services + repositories + storage(local)+email(console)+queue, with the account-status/permission guard completed.
- **Stage 3:** application-processes, dashboard, documents, email-templates, invitations, outbound-email, payments, settings, admin-management (independent modules — parallelizable).
- **Stage 4:** delete proxy layer + `FASTAPI_BASE_URL`; repoint `lib/api/server.ts`; final green.
