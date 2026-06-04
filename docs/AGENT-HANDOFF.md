# Handoff: Building Features in the Next.js Full-Stack ATS

**Audience:** an AI coding agent (or engineer) with **zero prior context**. Read this top to bottom before writing code.
**Date authored:** 2026-06-04.
**Status:** The FastAPI backend has been fully migrated into this Next.js app (MongoDB-only). The job-widget feature is built. This doc tells you how to add **new backend + frontend features** following the established conventions.

---

## 0. TL;DR

This is **one Next.js 15 (App Router) + TypeScript app that contains its own backend.** There is no separate API server. Business logic lives in `src/server/` (a layered TS module mirroring a classic FastAPI app), and `src/app/api/**/route.ts` files are thin controllers over it. **MongoDB is the only external dependency.**

To add a feature you almost always touch two layers:
1. **Backend:** `src/server/{schemas,repositories,services}` + a route handler in `src/app/api/...`.
2. **Frontend:** a page/route in `src/app/...` + the data layer (`lib/api/endpoints.ts`, `lib/query/keys.ts`) + components.

The single most important rule: **mirror the `positions` vertical** for a CRUD backend module, and **read `CLAUDE.md`** (non-negotiable frontend rules). When in doubt, copy an existing, working slice.

---

## 1. Repository & version control

```
applicant tracking system/
├─ application-tracking-system-backend/    ← LEGACY FastAPI source. Runtime-UNUSED. Behavior "oracle" only.
└─ application-tracking-system-frontend/   ← THE app (Next.js). Git repo. Work here.
```

- **All work happens in `application-tracking-system-frontend/`.** The FastAPI tree is kept only as a reference for original behavior — do not run it, do not depend on it.
- Git: branch `feat/nextjs-backend-migration` holds the migration + widget feature; **PR #1** is open against `master` (`nathanieluriri/application-tracking-system-frontend`).
- ⚠️ **There may be unrelated uncommitted WIP in the working tree** (e.g. an applicants slice, settings page, `components/ui/table.tsx`, sender-domain hooks/types/forms, design docs under `docs/superpowers/`). **Do not commit or clobber files you didn't create.** Use precise `git add <path>` per file — never `git add -A` across the tree. Branch for new work if appropriate.

---

## 2. Architecture (read before writing code)

### Backend — `src/server/`
Layered, mirrors FastAPI. **Nothing below `http/` may import `next/*`** (so services/repos/schemas run under Vitest and stay framework-agnostic).

```
src/server/
  core/
    database.ts        getClient()/getDb()/closeDb() — shared Mongo client; COLLECTIONS map of names
    settings.ts        getSettings() — typed env (memoized); loadSettings(env) is pure/testable
    errors.ts          AppError + ErrorCode enum + helpers (badRequest/notFound/conflict/unauthorized/
                       authInvalidToken/authRoleMismatch/authPermissionDenied/resourceNotFound, isAppError)
    response-envelope.ts  successEnvelope(data,msg,opts) / errorEnvelope(msg,data,opts)
    role-config.ts     normalizeRole + rate-limit rule parsing
    cache.ts           in-process TTL cache (cacheGet/Set/Delete/Clear)
    queue/             registry.ts (registerTask/registerTaskIfAbsent/executeRegisteredTask),
                       provider.ts (InlineJobProvider), manager.ts (QueueManager.enqueueSafely), tasks.ts (registerAllTasks)
    storage/           types.ts, local-provider.ts, manager.ts (DocumentStorageManager)
    email/             transport.ts (Console/SMTP), manager.ts (EmailManager), resend-domains.ts
    payments/          provider.ts, stripe.ts, flutterwave.ts, manager.ts (PaymentManager; stub-capable)
  schemas/             zod request schemas + TS doc interfaces + <x>Out(doc) normalizers + <x>CreateDoc builders
                       common.ts = shared enums/Permission/zod + nowSeconds/toObjectId/isValidObjectId/stringifyId
  repositories/        Mongo data access only (getDb + COLLECTIONS)
  security/            jwt.ts, hash.ts, tokens.ts, principal.ts, auth.ts (resolvePrincipal/verifyUser/Admin/...),
                       cookies.ts, permissions.ts (makePermissionKey/hasPermission), rate-limit.ts,
                       account-status.ts (checkAdmin/UserAccountStatusAndPermissions), issue-tokens.ts,
                       abuse-control.ts, permission-registry.ts (defaultAdminPermissions = wildcard)
  http/
    with-envelope.ts   withEnvelope(handler,{message,status}) → wraps result/errors into the JSON envelope
    guards.ts          requireUser/requireAdmin/requireAny/requireForRefresh/optionalAuth (Next-aware)
    request.ts         authInputFromRequest, getRequestId, parseJsonBody(req,zod), parseQuery(req,zod), refreshTokenFromRequest
    auth-response.ts   authResponse(req,entityWithTokens,msg,status) / clearAuthResponse — sets httpOnly cookies
```

### Frontend — `src/app`, `src/components`, `src/lib`
- App Router only. Default to **server components**; `"use client"` only for hooks/handlers/browser APIs.
- Client data: `lib/api/client.ts` `apiFetch<T>(path,{method,body})` (unwraps the `{data}` envelope; on 401 redirects to `/login`). Endpoints in `lib/api/endpoints.ts`. Query keys in `lib/query/keys.ts`. **TanStack Query** for client fetching.
- RSC prefetch: `lib/api/server.ts` `serverFetch<T>(path)` → calls the in-process `/api` same-origin and forwards cookies; it maps legacy `/v1/...` paths to `/api/...` automatically.
- Forms: zod schema in `lib/forms/schemas/<x>.ts` + `react-hook-form` + `zodResolver`. shadcn primitives in `components/ui/`. Toasts via `sonner`. Charts via Tremor. Icons via `lucide-react`.
- **`CLAUDE.md` rules are non-negotiable** (no modals for primary flows; mandatory loading skeletons; design tokens only; etc).

### Wire contract (do not break)
- Success: `{ success:true, message, data, meta?, requestId? }`. Error: `{ success:false, message, data:{ code, details } }`. 422 validation → `{ code:"VALIDATION_FAILED", details:{ errors:[zod issues] } }`.
- Auth: `access_token`/`refresh_token` httpOnly cookies (`sameSite=lax`, `secure` in prod). Roles `user`/`admin` (legacy `member`→`user`).

---

## 3. Recipe — add a BACKEND module (mirror `positions`)

Reference files to copy: `src/server/{schemas,repositories,services}/positions.ts`, `src/app/api/positions/route.ts`, `src/app/api/positions/[id]/route.ts`, and the tests `tests/services/positions.test.ts` + `tests/http/positions-routes.test.ts`.

1. **`src/server/schemas/<x>.ts`** — a `<x>CreateSchema`/`<x>UpdateSchema` (zod), a `<X>Doc` interface (DB shape), a `<x>Out(doc)` normalizer (`_id`→`id` string), and a `<x>CreateDoc(input, …)` builder.
   - **Never use zod `.default()` on a field a route body/query parses** — it desyncs `z.infer` input/output and breaks `parseJsonBody`/`parseQuery` typing. Use `.optional()` and apply the default inside `<x>CreateDoc`.
   - Use `nowSeconds`/`toObjectId`/`isValidObjectId` from `@server/schemas/common`.
2. **`src/server/repositories/<x>.ts`** — `getDb()` + `COLLECTIONS.<name>` (add the collection name to `COLLECTIONS` in `core/database.ts`). `for await (const doc of cursor)` loops; `findOneAndUpdate(..., { returnDocument: "after" })`.
3. **`src/server/services/<x>.ts`** — business logic, **no `next/*` imports**. Validate ids, throw `badRequest/notFound/conflict/...` from `@server/core/errors`. Background work via `QueueManager.enqueueSafely("task_key", payload)`.
4. **Routes** `src/app/api/<x>/route.ts` (+ `[id]/route.ts`, sub-routes) — thin controllers:
   ```ts
   export const GET = withEnvelope(async (req) => {
     await checkAdminAccountStatusAndPermissions(req, "GET:/<x>");   // admin-gated
     const q = parseQuery(req, listQuerySchema);
     return retrieve<X>(q);
   }, { message: "<X> fetched successfully" });

   export const POST = withEnvelope(async (req) => {
     const admin = await checkAdminAccountStatusAndPermissions(req, "POST:/<x>");
     const body = await parseJsonBody(req, <x>CreateSchema);
     return add<X>(body, admin.id!);
   }, { message: "<X> created", status: 201 });
   ```
   - **Permission key format:** the FastAPI route path WITHOUT the `/v1` prefix, WITH `{param}` placeholders, e.g. `"GET:/applications/{application_id}"`. Admins get a wildcard (`*`) so any key passes; keep keys accurate anyway.
   - Public endpoints: no guard (or `requireAny(req)` for any-token). Webhooks: read raw body with `await req.text()` before parsing; verify signatures; **fail closed in production** when the secret is unset.
   - `[id]` params: `const { id } = await ctx.params;` (it's a Promise).
   - Routing: static segments win over `[id]` (e.g. `/positions/public` coexists with `/positions/[id]`). Don't put a `[...catchAll]` next to named segments.
5. **Tests** in `tests/services/<x>.test.ts` (+ `tests/http/<x>-routes.test.ts`): copy the `startTestDb/clearDb/closeDb/stopTestDb` lifecycle from an existing test; use `newId()` from `tests/helpers/fixtures`. Cover the branches. Run `bun test`.

---

## 4. Recipe — add a FRONTEND feature

1. **Endpoints:** add a group to `lib/api/endpoints.ts` (`list/get/create/update/remove/...`).
2. **Query keys:** add to `qk` in `lib/query/keys.ts`.
3. **Nav (dashboard):** add a `NavItem` to `lib/nav/items.ts` (lucide icon + `match`).
4. **Dashboard page:** `src/app/dashboard/<x>/page.tsx` (server shell) → a `"use client"` view that uses `useQuery`/`useMutation` with `apiFetch(endpoints.<x>...())`. Add a `loading.tsx` skeleton. Use shadcn `Card/Button/Input/Switch/Select/Badge/AlertDialog/DropdownMenu`. Toasts via `sonner`. **No modals for primary create/edit** — use dedicated routes (`/dashboard/<x>/[id]/edit`). `AlertDialog` only for destructive confirms.
5. **Forms:** zod schema in `lib/forms/schemas/<x>.ts` + `react-hook-form` + `zodResolver`; map envelope field errors via `setError`; button loading state; success → toast + `router.push`; dirty-state guard for big forms.
6. **RSC data:** if a page should SSR data, fetch via `serverFetch<{ data: T }>("/api/<x>...")` in the server component (it forwards cookies).
7. **Public pages** (no auth, like `/careers`): put them under a path that the middleware treats as public (see §6) and give them their own `layout.tsx`. They can use `serverFetch` for public endpoints.

---

## 5. Auth & permissions model

- Two principals: **`user`** and **`admin`** (Mongo collections `users`/`admins`; access/refresh token records in `accessToken`/`refreshToken`; JWT carries the access-record id).
- `GET /api/auth/login|signup|me|refresh|logout` is the **user** flow. `GET /api/admins/login|profile|refresh|logout|account` + `GET/POST /api/admins` is the **admin** flow.
- **Dashboard data routes are admin-gated** via `checkAdminAccountStatusAndPermissions(req, key)` (checks: valid admin token → account ACTIVE → permission key in `permissionList`). New/seeded admins get a wildcard (`*`) permission (`defaultAdminPermissions()`), so they pass all checks.
- **Bootstrap:** `bun run seed` creates a super admin (`admin@ats.local` / `admin12345`); a super-admin env fallback (`SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD`) also logs in without a DB record.
- ⚠️ **Known caveat:** the frontend login page calls `/api/auth/login` (user), but the dashboard needs admin. To operate the dashboard, log in via `/api/admins/login`, OR repoint `/api/auth/*` to the admin services (see `src/server/services/admins.ts`). This is an intentional, flagged decision — confirm intent before building dashboard features that assume a user session.

---

## 6. Middleware, public surface, CORS

- `src/middleware.ts` (NOTE: it MUST live in `src/`, not the repo root, because the app uses `src/` — a root `middleware.ts` is silently ignored). It's the optimistic page auth-gate: unauthenticated → `302 /login`.
- `PUBLIC_PREFIXES` already includes `/api` (all API routes enforce their own auth + return 401 JSON, never a redirect), `/embed`, `/careers`, `/_next`, static. Add a prefix here for any new public page area.
- Cross-origin (e.g. the embeddable widget): expose CORS **only** on dedicated public routes under `/api/public/...` (set `Access-Control-Allow-Origin: *` + `OPTIONS`). They call the in-process service directly. Never widen CORS app-wide.

---

## 7. Running, testing, verifying

```
# MongoDB must be running (MONGODB_URI in .env.local; default mongodb://localhost:27017)
bun install
bun run seed          # super admin
bun dev               # whole app + backend
bun test              # vitest (server unit + route integration; in-memory Mongo)
bunx tsc --noEmit     # typecheck
```
- Tests live in `tests/<layer>/`; `tests/helpers/setup.ts` loads `.env.test`, registers tasks, and runs the queue synchronously. Repository/service tests use `mongodb-memory-server`.
- **Always run `bun test` + `bunx tsc --noEmit` before declaring done.** For anything touching routes/runtime, **also boot `bun dev` and curl the endpoint** — bundling issues (below) only surface in the real Next runtime, not in tsc/vitest.

---

## 8. Gotchas / pitfalls (these have already bitten — avoid them)

1. **zod `.default()` on parsed request fields** → input/output type desync. Use `.optional()` + default in the builder/service.
2. **Client bundle pulling Mongo:** a module imported by client code must NOT transitively import `mongodb`. `schemas/common.ts` imports `ObjectId` from **`bson`** (browser-safe), not `mongodb`. Keep server-only modules out of client components; client may import only types/zod/pure helpers.
3. **`serverExternalPackages`** in `next.config.ts` lists `mongodb`/`nodemailer`/`stripe`/`bcryptjs` so webpack doesn't bundle their Node-only deps for route handlers. Add any new heavy Node-only dep here.
4. **No heavy work in `instrumentation`/edge:** background tasks register lazily on first `enqueue` (Node route path). Don't add an `instrumentation.ts` that imports the Mongo chain — it gets compiled for edge and fails on `net`/`crypto`.
5. **Lazy-import optional SDKs** (`stripe`, `@aws-sdk/*`) so the app boots without their keys; providers run in **stub mode** when keys are absent and **fail closed in production**.
6. **RSC self-fetch origin** (`lib/api/server.ts`) comes from trusted config (`APP_ORIGIN`/`VERCEL_URL`/`PORT`), **never** request `Host` headers (SSRF/credential-forwarding).
7. **innerHTML / user content:** always HTML-escape; for embeddable output, render inside a sandboxed iframe/Shadow DOM and guard `href` schemes (no `javascript:`).
8. **Route conflicts:** don't mix `[...catchAll]` with named segments; static beats dynamic.
9. **Windows/bun dev server:** start it with `run_in_background` and NO trailing `&` (double-backgrounding kills it). Poll `/api/health` until 200.

---

## 9. What already exists (build on it, don't recreate)

- **Backend modules:** auth (users+admins), positions (+ public + `public/[id]`), applications (public apply, CV upload, abuse control, status history, bulk), application-processes, documents (+ local storage), dashboard (aggregation+cache), settings, email-templates, invitations, outbound-email (+ console/SMTP transport), payments (Stripe/Flutterwave), sender-domains, Google OAuth, widgets, health.
- **Job widget:** `widgets` resource + `/api/public/widgets/[id]` (headless), `/embed/widget.js` runtime + `lib/widget/{runtime,snippet,config}.ts`, hosted `/careers` + `/careers/[id]` + apply form, dashboard builder at `/dashboard/widgets`.
- **~194 tests** across `tests/`. Mirror the closest existing one.

## 10. Definition of done for a new feature

- `bun test` green (with new tests for your module/branches); `bunx tsc --noEmit` clean.
- Endpoint verified live (`bun dev` + curl) — envelope shape, auth (401 for protected, 200/201 happy path), and any public/CORS behavior.
- Frontend obeys `CLAUDE.md` (skeletons, no primary-flow modals, design tokens, query keys, RSC vs client split).
- No `next/*` import below `src/server/http/`; no `mongodb` in a client-reachable import path; no zod `.default()` on parsed fields.
- Commits scoped to your files (don't sweep unrelated WIP); update `CLAUDE.md`/this doc if you change a convention.
