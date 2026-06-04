# Loading-States UX Hardening + Next 16 Upgrade — Design

- **Date:** 2026-06-04
- **Status:** Approved (pending spec review)
- **Owner:** nuriri@introgroup-tech.com
- **Area:** `application-tracking-system-frontend` (Next.js App Router + TS + Tailwind + shadcn/ui)

---

## 1. Problem statement

The app already documents loading/feedback conventions in `CLAUDE.md` §3, but the
implementation only partially matches them, and several pieces the docs claim exist
do not. The goal is to make the whole app genuinely abide by sound loading-state UX
principles:

- **Progress bar** for finite work where real progress can be shown.
- **Spinner** for small, inline waits.
- **Skeleton** for data fetches where the page shape is already known.
- Plus accessibility and timing principles the original conventions omit
  (reduced motion, anti-flash / anti-flicker timing).

### Audit findings (current state)

**Already correct**

- `Spinner` has proper a11y (`role="status"`, `aria-live="polite"`, sr-only label).
- `ButtonLoading` (disabled + inline spinner + label swap) is used correctly in the
  login and signup forms — the right pattern for form submits.
- `LoadingOverlay` (absolute, `backdrop-blur`, `aria-busy`) exists for card/section mutations.
- Skeletons exist (`Table/Card/Kpi/Chart/Form/Detail`) and are wired into route-level
  `loading.tsx` for most dashboard routes, matching each page's shape.
- RSC data pages (Overview) fetch server-side and correctly rely on `loading.tsx`.
- Async Request APIs are **already** adopted: `app/api/_lib/catchAll.ts` types `params` as
  `Promise<…>`; `lib/api/server.ts` and `lib/auth/session.ts` use `await cookies()` /
  `await headers()`.

**Gaps / violations**

1. **Top navigation progress bar is entirely missing.** `CLAUDE.md` §3 claims it is
   "already wired in the dashboard layout via `useNavigationLoading`", but the hook,
   the component, and the wiring do **not** exist. Only an orphaned `.nav-progress`
   CSS class in `styles/globals.css` remains (referenced nowhere).
2. **No determinate progress at all.** `@radix-ui/react-progress` is installed, but there
   is no `components/ui/progress.tsx` and no usage anywhere. The "progress bar for finite
   things" principle has no implementation and no consuming UI.
3. **Root `app/loading.tsx` renders a bare full-page spinner** (`PageLoader`) — a direct
   violation of the app's own "never a bare spinner for a full page" rule.
4. **No `prefers-reduced-motion` handling.** Spinner spin, skeleton pulse, and the overlay
   animate unconditionally.
5. **No timing discipline.** No spinner *delay* (causes a flash on fast responses) and no
   *minimum display time* (causes flash-and-vanish flicker).
6. **`LoadingOverlay` double-announces** — the overlay has `aria-live` and so does its inner
   `Spinner`.

### Environment facts that shape the plan

- Installed Next is **15.5.15** (the `^15.1.3` caret resolved up), so the native
  navigation APIs (`useLinkStatus`, `onNavigate`) are **already available** — no upgrade is
  required to use them.
- Latest stable Next is **16.2.7**; the user chose to take the major upgrade as part of
  this work.
- Data layer is **TanStack Query**; forms use **react-hook-form + zod**; toasts use **sonner**.
- No test runner is configured (`package.json` scripts: `dev`, `build`, `start`, `lint`,
  `typecheck`).

---

## 2. Goals and non-goals

**Goals**

- Harden the shared loading system so every page that exists today is compliant, and leave
  reusable patterns for the stubbed pages to adopt later.
- Build the missing infrastructure: native top navigation progress bar, a determinate
  `Progress` primitive, and a real, reusable upload-with-percentage UI.
- Add the missing UX principles: reduced-motion support and anti-flash/anti-flicker timing.
- Fix the documented-but-false / violating bits (nav bar claim, root bare spinner).
- Upgrade to Next 16 as an isolated, verified-first phase.
- Correct `CLAUDE.md` so the documented rules match reality, and add the new rules.

**Non-goals**

- Building out the stubbed feature pages themselves (Applicants/Pipeline/Positions/Templates
  tables and forms). Those stay stubs; they receive reusable patterns and docs only.
- A major Next.js architecture change (Cache Components / PPR migration) — out of scope.
- A global loading-state store / orchestrator (rejected as over-engineering — see §4).

---

## 3. Decisions (resolved)

| # | Decision | Choice |
|---|---|---|
| D1 | Scope | Harden the loading **system** + make existing pages compliant + leave reusable patterns. Do **not** build out stub feature pages. |
| D2 | Determinate progress target | Build the real reusable upload-with-% UI now (primitive + XHR component/hook) **and** add the rules to `CLAUDE.md` so future upload/feature screens consume it. |
| D3 | Navigation API | Use the **native** API (`onNavigate` + `useLinkStatus`), not `history` monkeypatching. |
| D4 | Next version | Take the **major upgrade to Next 16** now, run as an isolated Phase 0, verified green before any UX work. |
| D5 | Abstraction level | Focused primitives + thin hooks matching the existing `components/feedback/*` style. No global store. |

---

## 4. Approaches considered

- **A — Focused primitives + thin hooks (chosen).** Small composable components/hooks with
  good UX defaults baked in. Matches the codebase, lowest risk, delivers everything.
- **B — Centralized loading orchestrator.** A zustand store tracking all in-flight ops +
  unified bar + `<AsyncBoundary>` everywhere. Rejected: heavier, fights App Router Suspense,
  over-engineered for an app that is still mostly stubs.
- **C — Minimal compliance only.** Fix violations + nav bar + progress primitive, skip
  timing/reduced-motion. Rejected: under-delivers on "any other UX principle."

---

## 5. Detailed design

### Phase 0 — Next 16 upgrade (isolated; gate before Phase 1)

Run the official codemod `npx @next/codemod@canary upgrade latest`, then hand-finish:

- **Dependencies:** `next@16`, `react@19.2`, `react-dom@19.2`, `@types/react`,
  `@types/react-dom` → latest.
- **ESLint:** `next lint` is removed in 16, and the project currently has **no** eslint
  dependency or config. Add `eslint` + `eslint-config-next` with a flat config
  (`eslint.config.mjs`) and change the `package.json` `lint` script from `next lint` to
  `eslint .`.
- **`middleware.ts` → `proxy.ts`:** rename the file and the exported `middleware` function
  to `proxy`; keep the `config.matcher` export. The logic is cookie-based redirects only,
  so the forced `nodejs` runtime is safe. Update all `CLAUDE.md` references that name
  "middleware" (§1 and elsewhere).
- **`next.config.ts`:** remove the now-stable `experimental.typedRoutes: false` line. No
  custom webpack config exists, so Turbopack-by-default needs no other change.
- **Prerequisite:** Node ≥ 20.9 (TS is already 5.8.3 ✓).

**Verify gate (must all pass before Phase 1):** `tsc --noEmit` clean · new `eslint` clean ·
`next build` (Turbopack) succeeds · manual auth-flow walkthrough (proxy redirect when
logged out, login, dashboard renders).

**Confirmed zero-exposure** (no code uses these, so the corresponding 16 breaking changes
do not apply): `next/image`, experimental PPR / `experimental_ppr`, parallel-route
`default.js`, AMP, `serverRuntimeConfig`/`publicRuntimeConfig`, `revalidateTag`,
global `scroll-behavior` override, custom webpack, `unstable_*` cache APIs.

### Phase 1 — Navigation feedback (native API)

- `providers/NavigationProgress.tsx` — a React context (`start()` / `done()`) plus a thin
  fixed top bar (2–3px, `--primary`), rendered once in `app/dashboard/layout.tsx`.
- `components/layout/NavLink.tsx` — wraps `next/link` and calls `start()` via the native
  `onNavigate` prop. Sidebar items route through `NavLink`.
- Completion: an effect keyed on `usePathname()` + `useSearchParams()` calls `done()` when
  the route actually changes.
- `hooks/useNavigate.ts` — wraps `router.push`/`router.replace` to call `start()` first, so
  post-mutation redirects also drive the bar.
- **Robustness:** the bar always completes (timeout safety net so an aborted/failed nav can
  never leave it stuck).
- **Reduced motion:** advances in discrete steps instead of a continuous shimmer; reuses /
  cleans up the existing `.nav-progress` CSS.
- **Optional inline indicator:** a small `useLinkStatus`-driven spinner on the clicked
  sidebar item (the "inline spinner" case). Implemented if cheap; not required for sign-off.

### Phase 2 — Determinate progress (real, reusable UI)

- `components/ui/progress.tsx` — shadcn-style Progress over `@radix-ui/react-progress`
  (determinate `value`, with `aria-valuenow`/`aria-valuemin`/`aria-valuemax` and an
  accessible label).
- `hooks/useUploadWithProgress.ts` — **XHR-based** upload (plain `fetch` cannot report
  upload progress), posting through the BFF (`/api/...`). Exposes `{ progress, status,
  error, start, cancel }` with real percentage, and supports **cancel / error / retry**.
- `components/feedback/UploadProgress.tsx` — presentational component pairing the hook with
  `<Progress>`, a percentage label, and cancel/retry controls. Built to drop into the
  resume/document-upload screen when it lands.
- **Indeterminate fallback:** when total size is unknown, render an indeterminate Progress
  (the primitive supports a `null`/undefined value) rather than a fake percentage.
- Add the determinate-progress rule + a usage snippet to `CLAUDE.md` §3.

### Phase 3 — Timing discipline (anti-flash + anti-flicker)

- `hooks/useDelayedFlag.ts` — `useDelayedFlag(active, { delay = 200, minDuration = 400 })`
  returns a boolean that turns on only after `delay` ms of `active`, and once on stays on
  for at least `minDuration`. Clears its timers on unmount.
- Baked into `LoadingOverlay` (and any inline loaders) with those defaults, overridable via
  props. Route-level `loading.tsx` skeletons remain immediate (App Router governs those).

### Phase 4 — Reduced motion + a11y polish

- `motion-reduce:` Tailwind variants — skeleton `animate-pulse` → static muted block; nav
  bar → discrete advance. The spinner keeps spinning (essential, functional feedback).
- Fix `LoadingOverlay`'s double `aria-live`: keep a single live region (drop the redundant
  announcement so screen readers don't hear "Loading" twice).
- Keep `aria-busy` / `role="status"` / sr-only labels consistent across all primitives.

### Phase 5 — Full-page / root fixes

- `app/loading.tsx` — replace the bare `PageLoader` spinner with a **branded splash**
  (app mark/name + a small spinner + sr-only "Loading"), so the root boot no longer
  violates the "no bare full-page spinner" rule.
- `app/(auth)/loading.tsx` — new auth-card skeleton matching the login/signup shape.
- Reconcile `PageLoader` so it cannot be misused as a full-page loader: repurpose it as the
  branded splash, or remove it and inline the splash.

### Phase 6 — Compliance sweep + docs

- Verify the existing forms remain compliant (login/signup already use `ButtonLoading`).
- Rewrite `CLAUDE.md` §3 to match reality: remove the false "nav bar already wired" claim;
  document the new reduced-motion, timing, and determinate-progress rules; fix
  middleware→proxy naming throughout.
- `components/feedback/AsyncBoundary.tsx` — a lightweight, documented helper standardizing
  client-query UI: `loading → skeleton`, `error → message + retry`, `empty → empty state`,
  and the **quiet background-refetch** rule (don't blow away existing content while
  `isFetching` with data present). Provided as the pattern the stub pages adopt later —
  offered, **not** retrofitted onto stubs in this work.

---

## 6. Error handling

- **Upload:** network/HTTP failure → inline error in `UploadProgress` + sonner toast +
  retry; user-initiated cancel aborts the XHR cleanly.
- **Navigation bar:** always completes; a safety timeout prevents a stuck bar on aborted or
  failed navigations.
- **Timing hooks:** all timers cleared on unmount to avoid state updates after unmount.

---

## 7. Verification

No automated test runner exists, so verification is:

- `bunx tsc --noEmit` (or `npm run typecheck`) — clean.
- New `eslint` — clean.
- `next build` (Turbopack) — succeeds.
- Dev-server walkthrough:
  - Warm sidebar navigation shows the top progress bar; it always completes.
  - DevTools "emulate prefers-reduced-motion" → skeleton static, bar discrete, spinner OK.
  - Throttled-network upload shows real climbing percentage; cancel and retry both work.
  - A fast mutation does **not** flash the overlay; a slow one shows it without flicker.
  - Auth flow (proxy redirect, login, logout) still works after the Next 16 rename.

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Next 16 major upgrade breaks the app | Isolated Phase 0 with a hard verify gate; small real surface because async APIs are already adopted; official codemod + manual finish. |
| `middleware`→`proxy` runtime change (`nodejs` only) | Logic is cookie redirects only — no edge-specific APIs — so `nodejs` runtime is safe. |
| Native nav API is per-link, not a global bus | Bridge `onNavigate` (start) + pathname/searchParams (done) + a `useNavigate` wrapper for `router.push` into one context. |
| Over-eager loaders causing flash / flicker | `useDelayedFlag` (delay + minDuration) baked into spinner-based feedback. |
| Reduced-motion regressions | Tailwind `motion-reduce:` variants on animated primitives; spinner intentionally preserved. |

---

## 9. New / edited files

**New:** `proxy.ts`, `eslint.config.mjs`, `providers/NavigationProgress.tsx`,
`components/layout/NavLink.tsx`, `components/ui/progress.tsx`,
`components/feedback/UploadProgress.tsx`, `hooks/useUploadWithProgress.ts`,
`hooks/useDelayedFlag.ts`, `hooks/useNavigate.ts`, `app/(auth)/loading.tsx`,
`components/feedback/AsyncBoundary.tsx`.

**Edited:** `package.json`, `next.config.ts`, `app/dashboard/layout.tsx`,
`components/feedback/LoadingOverlay.tsx`, `components/feedback/Spinner.tsx`,
`components/feedback/PageLoader.tsx`, `components/feedback/skeletons/*` (reduced-motion),
`app/loading.tsx`, `styles/globals.css`, `components/layout/DashboardSidebar.tsx`,
`CLAUDE.md`, (remove) `middleware.ts`.

---

## 10. Open questions

None — D1–D5 resolved. Ready for spec review, then an implementation plan.
