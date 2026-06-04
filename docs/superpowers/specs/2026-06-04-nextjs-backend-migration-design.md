# Next.js Backend Migration — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design)
**Owner:** nuriri@introgroup-tech.com

## 1. Summary

Migrate the entire FastAPI backend (`application-tracking-system-backend`, ~7.8k LOC, 108 files) into the existing Next.js 15 app (`application-tracking-system-frontend`) so the app is a single deployable unit with **MongoDB as its only external dependency**. The current Next.js BFF proxy layer (`src/app/api/<resource>/[...path]/route.ts` → `FASTAPI_BASE_URL`) is replaced by real route handlers backed by a layered server module that mirrors the FastAPI architecture.

All current backend features must work from the Next.js API after migration.

### Goals
- 1:1 functional parity with the FastAPI backend for every resource module.
- Preserve the wire contract (response envelope, auth cookies, JWT shape, endpoint paths) so the existing frontend (`middleware.ts`, `lib/api/*`, `endpoints.ts`, pages) keeps working with minimal change.
- Mirror the FastAPI layout (`core/`, `schemas/`, `repositories/`, `services/`, `security/`) in TypeScript so the structure is familiar.
- Unit tests with **Vitest**, organized to mirror the pytest/`core` layout.
- A self-contained `.env.local` that boots the app with only MongoDB running.

### Non-goals
- No Redis, Celery, or APScheduler runtime dependency (replaced by Mongo/in-process equivalents).
- No change to the frontend UI/UX, design tokens, or page routes.
- No new product features. This is a port, not a redesign.
- Real third-party credentials (Stripe/Flutterwave/S3/SMTP/Google) are optional; dev defaults are local/stub.

## 2. Current state

- **Frontend:** Next.js 15 App Router, React 19, bun, Tailwind + shadcn, TanStack Query, Zustand. Talks to its own `/api/...` handlers, which currently proxy to FastAPI.
- **Backend:** FastAPI, layered `api/v1 routes → services → repositories → schemas`, with `core/` subsystems (email, payments, queue, storage — provider/manager pattern), `security/` (JWT cookie auth, hashing, permissions, rate limiting, abuse control), MongoDB (motor), Redis (rate-limit/cache/Celery broker), Celery (jobs), APScheduler (heartbeat + cache warm), Stripe + Flutterwave, Google OAuth.

### Wire contracts that MUST be preserved
- **Response envelope:** `{ success: bool, message: string, data: any, meta?: object, requestId?: string }` (see `core/response_envelope.py`).
- **Error envelope:** `{ success: false, message, data: { code, details } }` with `code` from an `ErrorCode` enum (see `core/errors.py`). Validation errors use `422` + `{ code: "VALIDATION_FAILED", details: { errors: [...] } }`.
- **Auth cookies:** `access_token`, `refresh_token` — httpOnly, `sameSite=lax`, `secure` only in production, `path=/`. Max-ages from env (`ACCESS_TOKEN_MAX_AGE_SECONDS` default 24h, `REFRESH_TOKEN_MAX_AGE_SECONDS` default 30d).
- **Roles:** `user`, `admin`. Legacy alias `member` → `user`.
- **JWT:** payload embeds the DB token record id + `userId` + `role`. Verification decodes the JWT then looks up the token record in Mongo. Refresh tokens are DB records.
- **Endpoint paths:** the resource paths the frontend calls (see `lib/api/endpoints.ts`) stay identical at the `/api/...` layer.

## 3. Target architecture (Approach A)

Thin route handlers as controllers over a framework-agnostic layered server module.

```
src/
  app/api/<resource>/route.ts        ← controllers: validate → call service → withEnvelope
  app/api/auth/<action>/route.ts     ← login/signup/logout/refresh/me/google (real impls)
  server/
    core/
      database.ts          single Mongo client + typed db handle
      settings.ts          env → typed Settings (mirrors core/settings.py)
      response-envelope.ts successEnvelope/errorEnvelope + withEnvelope() wrapper
      errors.ts            AppError + ErrorCode enum + helpers
      role-config.ts       role normalization + rate-limit rule table
      logger.ts            admin/audit logger (mirrors core/admin_logger.py)
      cache/               mongo-ttl cache provider (replaces redis cache)
      queue/               task registry + JobProvider (inline default, mongo optional)
      storage/             provider + local + s3 (DocumentStorageManager)
      email/               manager + transport (console default, smtp optional)
      payments/            manager + provider + stripe + flutterwave
    schemas/               zod schemas per resource (validation + inferred types)
    repositories/          one module per Mongo collection (data access)
    services/              business logic; no next/* imports; unit-testable
    security/
      jwt.ts hash.ts tokens.ts cookies.ts principal.ts
      auth.ts permissions.ts rate-limit.ts abuse-control.ts account-status.ts
    http/
      with-envelope.ts     wrap handler result → JSON envelope, map AppError
      guards.ts            requireUser/requireAdmin/optionalAuth → AuthPrincipal
      request.ts           parse JSON/form body, query, params, request-id
tests/
  core/ schemas/ repositories/ services/ security/   ← mirrors pytest layout
  helpers/  in-memory mongo + provider mocks + fixtures
```

**Layering rules**
- `services/`, `repositories/`, `schemas/`, `security/` (except cookie helpers that take a response), and `core/` MUST NOT import from `next/*`. They are plain TS and run under Vitest directly.
- `app/api/**/route.ts` and `http/` are the only Next-aware layers. Controllers read cookies/headers, call services, set cookies, and wrap with `withEnvelope`.
- Cookie writes happen in controllers via a thin `cookies.ts` that operates on a `NextResponse` (or returns directives the controller applies).

## 4. Concept mapping (Python → TypeScript)

| FastAPI / Python | Next.js / TypeScript |
|---|---|
| pydantic `BaseModel` | `zod` schema; `z.infer` for the type |
| motor `db.collection` | `mongodb` driver, shared `MongoClient`, `getDb()` |
| `@document_response(...)` | `withEnvelope(handler, { message, status })` |
| `AppException` / `ErrorCode` | `AppError` class / `ErrorCode` string enum |
| `Depends(verify_admin_token)` | `const principal = await requireAdmin(req)` |
| `Depends(check_admin_account_status_and_permissions)` | `requireAdmin` + account-status + permission check guard |
| PyJWT / authlib JWT | `jose` (`SignJWT` / `jwtVerify`) |
| `bcrypt` | `bcryptjs` |
| Celery + `QueueManager` | task registry + `JobProvider`; `InlineJobProvider` (default), `MongoJobProvider` (optional) |
| Redis fixed-window rate limit | Mongo `rate_limits` collection, fixed-window, TTL index |
| Redis cache (dashboard warm) | Mongo `cache` collection w/ TTL index; in-memory fallback |
| APScheduler jobs | optional `instrumentation.ts` `setInterval` (drain jobs / warm cache) |
| S3 / local storage providers | same interface; local-disk default, S3 (`@aws-sdk/client-s3`) optional |
| SMTP email | `nodemailer`; console/JSON transport default |
| Stripe / Flutterwave SDK | `stripe` SDK + Flutterwave via `fetch`; behind provider interface; test/stub mode |
| `RequestIdMiddleware` etc. | `middleware.ts` + `withEnvelope` add `X-Request-ID`, timing |

## 5. Module inventory (parity targets)

Each module = `schemas` + `repository` + `service` + `route handler(s)` + tests. Endpoint paths preserved per `endpoints.ts`.

1. **auth/users** — `POST /api/auth/signup|login|logout|refresh`, `GET /api/auth/me`; Google OAuth start/callback. DB-backed access/refresh tokens, cookie set/clear, `user` role.
2. **admins** — admin auth + admin management, permissions listing (`GET` permission keys derived from routes), admin login/refresh, account status.
3. **applications** — public submit (multipart CV upload, honeypot, captcha, abuse guard, dup-submit guard), list/get/update (status history + email triggers), bulk status, CV download URL, delete, IP ban/unban.
4. **application-processes** — CRUD process templates, stages, resolve-process-for-position, default process.
5. **positions** — CRUD, public list, close, status.
6. **documents** — upload intent/complete, fetch + signed/download URL, delete; storage provider.
7. **email-templates** — CRUD templates, mounted/starter templates.
8. **outbound-email (emails)** — compose/send (queued), list, stats; uses email manager + queue.
9. **invitations** — create/list/revoke/resend, verify token, accept (creates admin/user); email send.
10. **dashboard** — overview aggregation with cache warm + `force_refresh`.
11. **settings** — get/update app settings.
12. **payments** — create payment/checkout, provider webhooks (Stripe + Flutterwave, raw-body signature verify), list/status.

Cross-cutting: rate limiting (role-aware), request-id + timing headers, abuse control (captcha/honeypot/IP-ban/CV validation), account-status checks, audit logging, health check (`GET /api/health` → mongo + jobs status).

## 6. Mongo-only infrastructure

### Rate limiting
- Collection `rate_limits`, key `{ id, window }`, fixed-window counter, TTL index on `expiresAt`.
- Same rule table as `role-config.py`: `anonymous` / `user` / `admin`, overridable via `ROLE_RATE_LIMITS` env.
- Enforced in `middleware.ts` (or a shared guard) returning `429` envelope with `X-RateLimit-*` + `Retry-After` headers, matching current behavior.

### Background jobs
- Port the task registry (`register_task` / `task` / `execute_registered_task`) verbatim.
- `JobProvider` interface. **`InlineJobProvider`** (default): runs the handler immediately; awaited in tests, fire-and-forget (`void`) in request handlers, with error logging. **`MongoJobProvider`** (optional, `JOB_BACKEND=mongo`): writes to a `jobs` collection drained by a runner started in `instrumentation.ts`.
- Call sites unchanged in spirit: `enqueue(taskKey, payload)`.
- Registered tasks (from current code): `send_application_acknowledgement`, `send_status_change_email`, `dashboard_refresh`, plus invitation/outbound email sends.

### Cache
- `cache` collection with TTL index; `get/set(key, value, ttl)`. Dashboard overview cached; `force_refresh=true` bypasses. In-memory Map fallback when Mongo cache disabled.

### Scheduler (optional)
- `instrumentation.ts` may start light intervals to drain the Mongo job queue and warm the dashboard cache. Not required for correctness in inline mode.

## 7. Auth & envelope details

- `security/jwt.ts`: sign/verify with `jose`; payload `{ accessToken: <recordId>, userId, role }`; admin vs member token variants; `decode` + `decodeAllowExpired`.
- `security/tokens.ts`: create access/refresh token DB records (collections `accesstoken`, `refreshtoken` or as currently named), validate, rotate. Mirrors `tokens_repo.py` + `security/tokens.py`.
- `security/auth.ts`: extract JWT from `Authorization: Bearer` or `access_token` cookie → resolve principal → role checks (`verifyUser`, `verifyAdmin`, `verifyAnyToken`, refresh variants).
- `security/cookies.ts`: set/clear auth cookies on a response; `shouldReturnTokens` honors `X-Return-Tokens`.
- **Silent refresh:** the 401-retry-with-refresh logic currently in `proxy.ts` is provided as a `withAuth` helper / handled in the client flow; server route handlers issue refreshed cookies on `/api/auth/refresh`.
- `withEnvelope` adds `X-Request-ID` (from incoming header or generated) and `X-Process-Time`.

Result: `middleware.ts`, `lib/api/client.ts`, `endpoints.ts` unchanged; `lib/api/server.ts` switches from calling `FASTAPI_BASE_URL` to calling internal services/handlers (server-side) — its public signature stays the same.

## 8. Providers (real interface, dev defaults)

- **Storage:** `StorageProvider` interface (`createUploadIntent`, `completeUpload`, `saveBytes`, `getDownloadUrl`, `delete`). `LocalStorageProvider` (default, disk under `STORAGE_LOCAL_ROOT`) + `S3StorageProvider` (optional). `DocumentStorageManager.configureFromSettings()`.
- **Email:** `EmailTransport` interface. `ConsoleTransport` (default — logs JSON), `SmtpTransport` (nodemailer, optional). `EmailManager` with retry/backoff settings; send via queue.
- **Payments:** `PaymentProvider` interface (`createPayment`, `verifyWebhook`, `getStatus`). `StripeProvider` + `FlutterwaveProvider`; behave in stub/test mode when keys absent. `PaymentManager.configureFromSettings()` — unavailable (not crashing) when no provider configured, matching current lifespan behavior.

## 9. Testing strategy (Vitest)

- Runner: `vitest`. Config: `vitest.config.ts`, `tests/` root, path aliases matching `tsconfig`.
- DB tests: `mongodb-memory-server` spun up per suite; repositories/services tested against real in-memory Mongo. `tests/helpers/db.ts` manages lifecycle + cleanup.
- Provider mocks: email/storage/payments mocked via the manager interfaces; `InlineJobProvider` with a capture spy to assert enqueued tasks.
- Port the 4 existing backend tests first: `response-envelope`, `permissions`, `role-config`, `queue-registry`.
- Coverage target: every `service` and `security` module has unit tests; each repository has CRUD tests; controllers covered by a handful of integration tests (envelope shape, auth guard, validation 422).
- Scripts: `bun test` → `vitest run`; `bun test:watch` → `vitest`.

## 10. `.env.local`

Self-contained; app boots with only Mongo running. Keys (dev values where safe, placeholders otherwise):

```
ENV=development
MONGODB_URI=mongodb://localhost:27017
DB_NAME=ats
SECRET_KEY=<dev-secret>
SESSION_SECRET_KEY=<dev-session-secret>
ACCESS_TOKEN_MAX_AGE_SECONDS=86400
REFRESH_TOKEN_MAX_AGE_SECONDS=2592000
CORS_ORIGINS=http://localhost:3000
ROLE_RATE_LIMITS=anonymous:20/minute,user:80/minute,admin:140/minute
JOB_BACKEND=inline
STORAGE_BACKEND=local
STORAGE_LOCAL_ROOT=./.storage
EMAIL_TRANSPORT=console
EMAIL_FROM_EMAIL=no-reply@ats.local
EMAIL_SENDER_NAME=ATS
PAYMENT_DEFAULT_PROVIDER=stripe
# Optional integrations (leave blank to run in dev/stub mode):
# STRIPE_SECRET_KEY= / STRIPE_WEBHOOK_SECRET=
# FLUTTERWAVE_SECRET_KEY= / FLUTTERWAVE_WEBHOOK_SECRET_HASH=
# S3_BUCKET_NAME= / S3_REGION= / S3_ENDPOINT_URL=
# EMAIL_HOST= / EMAIL_PORT= / EMAIL_USERNAME= / EMAIL_PASSWORD=
# GOOGLE_CLIENT_ID= / GOOGLE_CLIENT_SECRET=
```

The existing `.env.local` (`FASTAPI_BASE_URL`, `NEXT_PUBLIC_APP_NAME`) is superseded; `FASTAPI_BASE_URL` is removed at the end of the migration. `NEXT_PUBLIC_APP_NAME` is kept.

## 11. Dependencies to add

`mongodb`, `zod` (already present), `jose`, `bcryptjs`, `nodemailer`, `stripe`, `@aws-sdk/client-s3` (optional/lazy), and dev: `vitest`, `mongodb-memory-server`, `@types/bcryptjs`, `@types/nodemailer`. S3/Stripe SDKs imported lazily so they're not required to boot.

## 12. Sequencing

1. **Foundation:** `core/` (database, settings, response-envelope, errors, role-config, logger), `security/` (jwt, hash, tokens, cookies, principal, auth, permissions, rate-limit), `http/` helpers, Vitest setup, `.env.local`, dependencies. Port the 4 existing tests.
2. **Core verticals (end-to-end, tested):** auth (users + admins), applications, positions. Includes storage (local) + queue (inline) + email (console) enough to support application submit + status emails.
3. **Replicate** across remaining modules: application-processes, dashboard, documents, email-templates, invitations, outbound-email, payments, settings, admin management.
4. **Cleanup:** delete `[...path]` proxies + `_lib/proxy.ts` + `_lib/catchAll.ts` + `FASTAPI_BASE_URL`; point `lib/api/server.ts` internally; full `tsc --noEmit`, `lint`, `vitest run` green.

Stages 1–2 are reviewed before stage 3 fans out.

## 13. Risks & mitigations

- **Hidden behavior in services** (e.g., status-history side effects, dup-submit window): mitigated by reading each service during its port and writing characterization tests.
- **Multipart upload parity** (public application CV): Next route handlers use `await req.formData()`; validate content-type/size like `validate_cv_bytes`.
- **Webhook raw-body signatures** (Stripe/Flutterwave): read raw body via `await req.text()` before JSON parse; verify signature.
- **JWT/token shape drift:** port payload fields exactly; add a cross-check test that a token minted by the new code resolves to the same principal.
- **Scope size:** phased delivery; each module independently testable; the legacy FastAPI tree stays in the repo until stage 4 completes, as a reference oracle.

## 14. Definition of done

- Every endpoint in `endpoints.ts` (and the public/auth/webhook endpoints) served by Next.js route handlers with parity behavior.
- `.env.local` boots the app with only Mongo; smoke flow (signup → login → me → create position → public apply → list applications → dashboard) works.
- `vitest run` green; `tsc --noEmit` clean; `next lint` clean.
- Proxy layer + `FASTAPI_BASE_URL` removed. FastAPI backend no longer required at runtime.
