# Frontend Rules — applicant-tracking-system-frontend

This is a **Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui** application that masks a FastAPI backend behind its own `/api/...` route handlers. Read these rules before changing anything in this folder.

The full migration design lives at the repo root: `../frontend.plan.md`. When in doubt, that is the source of truth — this file is the short list of rules.

---

## 1. Architecture rules (non-negotiable)

- **App Router only.** No `pages/` directory. New routes go under `src/app/`.
- **Auth uses `httpOnly` cookies.** `access_token` and `refresh_token` are set by FastAPI and forwarded by our BFF. **Never** read or write tokens from JavaScript. **Never** put tokens in `localStorage` or `sessionStorage`.
- **The browser never talks to FastAPI directly.** Every client call goes to `/api/...` on this Next.js app, which proxies to FastAPI server-side. If you find yourself writing `fetch('http://...:8000/...')` in a client component, stop — add a route handler instead.
- **`middleware.ts` is the auth gate.** It checks for the `access_token` cookie and 302s unauthenticated users to `/login?next=<path>`. Don't duplicate that check in every page.
- **Real auth is enforced by FastAPI on every BFF call.** Middleware is optimistic; trust the upstream 401.
- **`FASTAPI_BASE_URL` is server-only.** Never import it into a client component. Never prefix it with `NEXT_PUBLIC_`.

## 2. Routing & navigation rules

- **No modals for primary flows.** Create / edit / view / compose all happen on **dedicated routes**, not inside a `<Dialog>`. The only acceptable modal is `<AlertDialog>` for irreversible confirm prompts ("Delete this applicant?").
- Examples of the rule:
  - "Compose email" → `/dashboard/emails/compose` (a page), **not** an `<EmailComposer>` modal.
  - "Edit applicant" → `/dashboard/applicants/[id]/edit`, **not** an inline modal.
  - "View applicant detail" → `/dashboard/applicants/[id]`, **not** a slide-over.
- Use `<Link>` for navigation, not `<a href>`. Use `router.push()` only after mutations, not for normal navigation.
- Multi-step forms keep state in the URL (via nuqs) where possible so refresh doesn't lose it.

## 3. Loading & feedback rules

Every interaction that waits on a network response must give visible feedback. Pick the right kind:

| Situation | Required feedback |
|---|---|
| Cold-loading a page | A `loading.tsx` skeleton matching the page shape (table → table skeleton, KPI grid → card skeletons). **Never a bare spinner for a full page.** |
| Warm route navigation | Top progress bar via the `useNavigationLoading` hook (already wired in the dashboard layout). |
| Form submit / button awaiting response | Button enters loading state: disabled + inline spinner + label changes to "Saving…" / "Sending…". Use `<ButtonLoading>` or the pattern in `components/feedback/`. |
| Mutation that updates a card/section | `<LoadingOverlay>` over the affected card (`absolute`, blurred bg, centered spinner, `aria-busy`). |
| Toggle / star / archive (optimistic-friendly) | Apply UI change immediately; roll back on error; sonner toast on success/failure. |

**Skeletons live in `components/feedback/skeletons/`.** When you create a new list / detail / form component, create a sibling skeleton with matching dimensions.

## 4. Component library rules

- **Use shadcn/ui first.** Check `components/ui/` before reaching for a third-party widget. To add a missing primitive: `npx shadcn@latest add <name>`.
- **Use Tremor for analytics** (`@tremor/react`): `<Card>`, `<Metric>`, `<BadgeDelta>`, `<AreaChart>`, `<DonutChart>`, `<BarList>`, `<SparkAreaChart>`. Don't hand-roll charts with raw recharts unless Tremor doesn't cover the case.
- **Never recreate a primitive** that already exists in `components/ui/` (Button, Input, Select, Table, Tabs, etc.).
- **Icons** come from `lucide-react` only.
- **Toasts** use `sonner`. Do not import the legacy `useToast` hook — that's gone with the Vite version.

## 5. Sidebar styling (the user is specific about this)

- Background: dark green (`bg-sidebar` token, set to `hsl(145, 63%, 18%)`).
- Text: white (`text-sidebar-foreground`).
- Inactive item text: soft white (`text-sidebar-muted` ≈ 90% lightness).
- Active item: `bg-sidebar-accent` + 3px left bar in `--sidebar-primary` + white text + medium weight.
- Hover: `bg-sidebar-accent/80` + white text.
- If you change a sidebar token, update `src/styles/globals.css` AND verify the active/hover states still look right.

## 6. Data layer rules

- **TanStack Query** for all data fetching in client components. Query keys come from `lib/query/keys.ts` — don't hand-roll string keys inline.
- **RSC pages prefetch** via `lib/api/server.ts` and hydrate the client tree where helpful, but the client component still owns the active query.
- **Endpoints are typed in `lib/api/endpoints.ts`.** If you call an endpoint that isn't in there, add it there first.
- **Mutations use `useMutation`** with `onMutate` for optimistic UI where it makes sense, `onError` rollback, and `onSettled` invalidation.
- **List pages** keep search/filter/page state in the URL via `nuqs`, not local state. This survives refresh and is shareable.

## 7. Forms rules

- **Schema-first.** Define a zod schema in `lib/forms/schemas/<resource>.ts`. Use it with `react-hook-form` via `zodResolver`.
- **No modals for forms** (see §2).
- **Server errors** are parsed from the FastAPI envelope `{ message, data: { code, details: { errors: [...] } } }` and mapped onto fields with `setError()`. Non-field errors render as a top-of-form `<Alert variant="destructive">`.
- **Submit buttons** show inline loading state. **Never disable the cancel button.**
- **On success:** sonner toast, then `router.push()` to the list or detail. Don't stay on the form.
- **Dirty-state guard:** warn before navigating away with unsaved changes.

## 8. Server vs client component rules

- Default to **server components**. Only mark a file `"use client"` when it actually needs hooks, browser APIs, or event handlers.
- Auth-aware data: read `cookies()` and call `lib/api/server.ts` from RSC.
- Don't import server-only modules (`server-only`, `next/headers`, `lib/api/server.ts`) from client components — TypeScript and the `server-only` package will catch this; respect the error rather than working around it.

## 9. Styling rules

- Tailwind only. No CSS modules, no styled-components.
- Use the design tokens (`--primary`, `--accent`, `--sidebar-*`, etc.). Never hard-code colours like `#10b981` — use `bg-primary`, `text-sidebar-foreground`, etc.
- `cn()` from `lib/utils.ts` for conditional classes.
- Mobile-first: every page must work on a 360px viewport. Test the sidebar's mobile sheet behaviour after layout changes.

## 10. File organisation

```
src/
  app/                  ← routes (App Router)
    (auth)/             ← unauthed layout group (no sidebar)
    (dashboard)/        ← authed layout group (sidebar + topbar)
    api/                ← BFF route handlers; never client-imported
  components/
    ui/                 ← shadcn primitives — don't edit, regenerate
    layout/             ← Sidebar, Topbar, PageHeader
    feedback/           ← Spinner, LoadingOverlay, skeletons/
    analytics/          ← Tremor-based charts
    <resource>/         ← feature-specific components
  lib/
    api/                ← endpoints, client+server fetchers
    query/              ← QueryClient, keys, hooks
    auth/               ← session, permissions
    forms/schemas/      ← zod schemas
    utils.ts
  hooks/                ← shared hooks
  providers/            ← React context providers used by app/layout.tsx
  styles/globals.css
  types/                ← shared TS types
```

When you add a new feature, follow this layout. When in doubt, mimic the `applicants/` slice — it's the reference vertical.

## 11. Things to never do

- Never write `localStorage.setItem('token', ...)` or any cousin of it.
- Never expose `FASTAPI_BASE_URL` to the client.
- Never put a primary user flow inside a `<Dialog>` / `<Sheet>` modal — use a route.
- Never block a route with a generic spinner when a skeleton would fit.
- Never hand-roll a chart with raw `<svg>` or div-width hacks when Tremor / recharts can render it.
- Never invent a new colour outside the design tokens.
- Never bypass the BFF by calling FastAPI directly from the browser.
- Never log tokens, cookies, or PII to the console.

## 12. Useful commands

```
bun dev              # local dev (Next.js)
bun build            # production build
bun lint
bunx shadcn@latest add <component>
bunx tsc --noEmit    # type check
```

## 13. Pointers

- Migration plan: `../frontend.plan.md`
- Backend (FastAPI) routes: `../application-tracking-system-backend/api/v1/`
- Backend cookie helpers: `../application-tracking-system-backend/security/cookies.py`
- Response envelope shape: `../application-tracking-system-backend/core/response_envelope.py`
