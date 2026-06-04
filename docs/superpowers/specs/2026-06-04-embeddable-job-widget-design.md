# Embeddable Job Widget — Design

**Date:** 2026-06-04
**Status:** Approved (brainstorming) → ready for implementation planning
**Scope:** New feature spanning FastAPI backend (`widgets` resource) and the Next.js frontend (BFF routes, embed runtime, hosted careers pages, dashboard builder).

---

## 1. Summary

Let admins generate embeddable job widgets — a small HTML/`<script>` snippet they paste anywhere on their own website. The widget shows the company's current open roles, is visually customizable through a dashboard builder, and links candidates to a hosted careers page on the ATS where they apply. A documented public JSON API supports a fully "headless" mode for developers who want to build their own UI.

This is a single-organization system (`org_id = "singleton"`), so a widget always shows *this* company's openings — no tenant key is required.

### Goals
- One-line `<script>` embed that renders current openings on any external site.
- Visual builder: theme/colors, layout, content & fields, filtering.
- Multiple named, independently-configured widgets, each with its own embed code.
- Edits go live without re-pasting the snippet (config stored server-side, referenced by ID).
- A polished hosted apply flow (`/careers`, `/careers/[id]`).
- A documented public API for headless use.

### Non-goals (explicitly out of scope per brainstorming)
- A per-role custom-HTML-template editor (placeholders like `{{title}}`).
- A custom-CSS override box.
- Inline application form inside the embedded widget (apply happens on the hosted careers page).
- Multi-tenant / per-customer widget secrets.

> Note on "on-the-fly custom HTML": this is satisfied by (a) the generated embed snippet being plain HTML the user owns and pastes, and (b) the documented public API for headless rendering. If a template/CSS editor is wanted later, it slots in as an added extensibility tier without changing this architecture.

---

## 2. Architecture & data flow

A customer pastes one `<script>` tag. The script (served by the ATS) reads its `data-widget="<id>"`, fetches that widget's config + filtered open roles in a single request, and renders the chosen layout inside a **Shadow DOM** for style isolation. "Apply now" deep-links to a hosted careers page on the ATS.

```
Customer site                 ATS (Next.js)                       FastAPI
─────────────                 ──────────────                      ───────
<script data-widget=ID> ──►  /embed/widget.js (cached JS)
   │ runs, reads ID + data-*
   └─ fetch ──────────────►  /api/public/widgets/ID  ──(server-side)──►  GET /v1/widgets/ID/data
                                 (CORS: *, no auth)                        { widget, roles[] }
   ◄─ render in Shadow DOM ──┘
   "Apply now" ───────────►  /careers/ID  (hosted page) ──► POST /api/applications ──► POST /v1/applications/
   "View open roles" ─────►  /careers
```

**CORS strategy (deliberate):** The only cross-origin requests are GETs to a couple of **Next** public route handlers that set `Access-Control-Allow-Origin: *`. Those proxy to FastAPI **server-side**, so FastAPI's existing locked-down CORS config is left unchanged. The application `POST` happens *same-origin* from the ATS's own `/careers/[id]` page, so it needs no cross-origin handling.

---

## 3. Backend (FastAPI) — `widgets` resource

Follow the existing `positions` vertical exactly: `schemas/widget_schema.py` → `repositories/widget_repo.py` → `services/widget_service.py` → `api/v1/widget_route.py`, registered in the v1 router. New Mongo collection: `widgets`.

### 3.1 Config schema (`widget_schema.py`)

```
LayoutStyle  = Literal["list", "grid", "compact"]
ThemeMode    = Literal["dark", "light", "auto"]
FontChoice   = Literal["system", "inherit"]
WidgetStatus = Literal["active", "disabled"]

ThemeConfig:
  mode: ThemeMode = "dark"
  accent: str = "#ffffff"          # hex
  background: Optional[str] = None # hex override; None = derive from mode
  radius: int = 14                 # px
  font: FontChoice = "system"

FieldsConfig:
  department: bool = True
  location: bool = True
  employment_type: bool = False
  posted_date: bool = False

ContentConfig:
  show_header: bool = True
  heading: str = "Featured roles"
  subtitle: str = "We're always seeking talented individuals to join our team."
  cta_label: str = "Apply now"
  show_view_all: bool = True
  view_all_label: str = "View open roles"
  view_all_url: Optional[str] = None   # None = hosted /careers
  fields: FieldsConfig

FiltersConfig:
  departments: List[str] = []          # empty = all
  locations: List[str] = []
  employment_types: List[EmploymentType] = []
  max_roles: int = 10                  # 0 = unlimited

BehaviorConfig:
  enable_search: bool = False
  enable_filters: bool = False
  open_in_new_tab: bool = True

WidgetBase:
  name: str
  status: WidgetStatus = "active"
  layout: LayoutStyle = "list"
  theme: ThemeConfig
  content: ContentConfig
  filters: FiltersConfig
  behavior: BehaviorConfig

WidgetCreate(WidgetBase): created_by, date_created, last_updated
WidgetUpdate: all fields Optional + last_updated
WidgetOut(WidgetBase): id (alias _id), created_by, date_created, last_updated
WidgetPublicData: { widget: <render-safe subset>, roles: List[PositionOut] }
```

`WidgetPublicData.widget` excludes `created_by` and internal timestamps — only fields the renderer needs.

### 3.2 Endpoints (`widget_route.py`)

Admin (behind `check_admin_account_status_and_permissions`, like positions):
- `GET    /v1/widgets/`            — list (start/stop pagination)
- `POST   /v1/widgets/`            — create (injects `created_by` from admin)
- `GET    /v1/widgets/{id}`        — get one
- `PATCH  /v1/widgets/{id}`        — update
- `DELETE /v1/widgets/{id}`        — delete
- `POST   /v1/widgets/{id}/duplicate` — clone with " (copy)" name

Public (no auth; consumed server-side by Next):
- `GET /v1/widgets/{id}/data` — returns `WidgetPublicData`. Resolves filters and `max_roles` against open positions **authoritatively on the server**. If the widget is missing → 404 envelope; if `status == "disabled"` → 200 with `{ widget: { status: "disabled" }, roles: [] }` (renderer shows graceful empty state, never an error).

Filtering reuses `retrieve_open_positions` then applies department/location/employment_type filters + limit, OR a dedicated repo query — implementer's choice, but the limit must be enforced server-side.

All responses use the standard `document_response` envelope.

---

## 4. Frontend BFF — Next route handlers

- `src/app/api/widgets/[...path]/route.ts` — admin CRUD proxy via `makeCatchAllHandler("/v1/widgets")` (cookie auth). Identical pattern to `positions`.
- `src/app/api/public/widgets/[id]/route.ts` — **public** `GET` handler:
  - No cookie/auth.
  - Sets `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, OPTIONS`, and handles `OPTIONS` preflight.
  - `Cache-Control: public, max-age=60, s-maxage=60` (short — config can change).
  - Server-side fetches `${FASTAPI_BASE_URL}/v1/widgets/{id}/data` and returns the JSON. Does **not** use `forwardToFastAPI` cookie logic — it's a plain server-side fetch with no credentials.
- `src/app/embed/widget.js/route.ts` (or `src/app/embed/[[...v]]/widget.js`) — returns the runtime script:
  - `Content-Type: text/javascript; charset=utf-8`
  - `Cache-Control: public, max-age=3600, immutable` (consider a `?v=` query for cache-busting on deploy).
  - `Access-Control-Allow-Origin: *`.
  - Script body is a string constant; the route can inject nothing secret (the script self-discovers its API base from its own `<script src>` origin).

### 4.1 `middleware.ts` allowlist additions
Add to public matching so they bypass the auth gate:
- Prefixes: `/api/public`, `/embed`, `/api/applications`, `/api/positions`
- Paths/prefix: `/careers`

(Keep these GET-public; `/api/applications` POST is the public submit and is already abuse-guarded upstream.)

---

## 5. The widget runtime (`widget.js`)

Vanilla JS, dependency-free, wrapped in an IIFE. **No React** — it must be tiny and never conflict with the host page. Multiple widgets per page must work.

Responsibilities:
1. Locate the invoking `<script>` (`document.currentScript`, with a fallback scan) and read `data-widget="<id>"` plus optional `data-*` overrides (e.g. `data-theme`, `data-accent`, `data-layout`) that win over stored config for quick tweaks.
2. Derive API base from the script's own `src` origin.
3. Determine the mount node: an explicit `data-target="#sel"` / a `<div id="ats-jobs">` if present, else insert a `<div>` immediately after the script tag.
4. Attach a **Shadow DOM** root to the mount node.
5. Render a **skeleton** immediately; `fetch` `/api/public/widgets/{id}`; on success render the layout; handle **empty** ("No open roles right now"), **disabled**, and **error** (small inline message — never throw into the host page) states.
6. Theme via CSS custom properties computed from config (`mode`, `accent`, `background`, `radius`, `font`); ship scoped CSS for all three layouts (list / grid / compact).
7. Optional client-side **search** box and **filter** chips (when `behavior.enable_search` / `enable_filters`), operating over the fetched roles.
8. Links: each role's "Apply" → the hosted role page `/careers/{positionId}`; "View open roles" → `content.view_all_url ?? /careers`. Honor `open_in_new_tab`.
9. Accessibility: semantic `<ul>/<li>`, real `<a>` elements, visible focus styles, `aria-busy` during load.

Layouts match the approved mockups:
- **list** (default): centered header + CTA pill, full-width rows with hairline dividers, location + "Apply now ↗" right-aligned.
- **grid**: responsive 2-col cards (1 col under ~520px), department chip + employment type.
- **compact**: dense single-line rows for sidebars/footers.

---

## 6. Hosted careers pages (public, Next)

- `src/app/careers/page.tsx` — server-rendered list of open roles (fetched via the server API helper hitting positions/public). Same visual language as the default widget. Public layout (no dashboard sidebar).
- `src/app/careers/[id]/page.tsx` — role detail (title, department, location, employment_type, description, requirements) + application form.
- Application form: `react-hook-form` + zod schema in `lib/forms/schemas/application.ts`. Fields: `full_name`, `email`, `phone?`, `experience?`, `location?`, `cv` (file). Always includes the **honeypot** `website` field (hidden). Renders a captcha widget **only when a captcha provider is configured** (optional, env-flagged — backend's `verify_captcha` is a no-op unless `CAPTCHA_PROVIDER` is set). Submits `multipart/form-data` to `/api/applications` (BFF → `POST /v1/applications/`).
- States: submit button loading state per repo rules; success → thank-you confirmation; server errors mapped from the FastAPI envelope.
- A public-facing minimal header/footer (logo/company name) — no auth-gated chrome.

---

## 7. Dashboard builder UI

New nav item **Widgets** in `lib/nav/items.ts` (lucide `LayoutGrid` or `Blocks`), route group `(dashboard)`.

- `src/app/dashboard/widgets/page.tsx` — list of saved widgets: name, layout badge, status, role count; row actions: **Copy embed code**, Edit, Duplicate, Delete (`AlertDialog` confirm). Empty state with "Create your first widget". `loading.tsx` skeleton.
- `src/app/dashboard/widgets/new` flow — create via the edit page with a draft, or a small create action that POSTs then routes to edit.
- `src/app/dashboard/widgets/[id]/edit/page.tsx` — **split view** (dedicated route, no modal per repo §2):
  - **Left:** control panel using shadcn primitives — Theme (mode, accent color picker, background, radius, font), Layout (list/grid/compact), Content (header toggle, heading, subtitle, CTA label, view-all toggle/label/url, field toggles), Filters (department/location/type multiselect, max roles), Behavior (search, filters, new tab).
  - **Right:** **live preview** rendering the *actual* `widget.js` against the in-progress config — implemented as a sandboxed `<iframe>` that loads the widget with a preview/override mechanism so the Shadow-DOM output is faithful — plus the generated **embed snippet** in a code block with a copy button.
  - Data layer: TanStack Query (keys in `lib/query/keys.ts`), `useMutation` for save with optimistic-friendly invalidation, sonner toasts, zod schema in `lib/forms/schemas/widget.ts`. Dirty-state guard.
- Endpoints registered in `lib/api/endpoints.ts`.

### 7.1 Embed snippet shape
```html
<div id="ats-jobs-<shortid>"></div>
<script src="https://<ats-host>/embed/widget.js" data-widget="<WIDGET_ID>" async></script>
```
Snippet generation is a pure function (testable) given `{ host, widgetId }`.

---

## 8. Extensibility — public API + docs (headless)

A docs surface (a tab on the widget edit page and/or `/dashboard/widgets` help panel) documents the stable public endpoints for developers who want to skip the renderer:
- `GET /api/public/widgets/{id}` → `{ widget, roles[] }` (config + filtered roles).
- `GET /v1/positions/public` (and its BFF mirror) → raw open roles.

Includes the JSON shape, the role object fields, CORS notes, and a minimal "build your own" fetch example.

---

## 9. Security & resilience

- Open roles are already public; the snippet carries no secret. Widget IDs are opaque ObjectIds.
- Public Next routes are GET-only, short-cached, and call FastAPI server-side without credentials.
- Disabled/deleted widgets render a graceful empty state — never an error dump or stack trace into the host page.
- The runtime is fully namespaced (IIFE, Shadow DOM); any fetch/render failure degrades to a small inline message and never throws into the host page's global scope.
- Submissions remain protected by the existing abuse guard (per-IP hourly/daily limits, IP ban list), the honeypot field, optional captcha, and CV byte validation — all already implemented upstream.
- Never expose `FASTAPI_BASE_URL` to the client; the embed script only ever talks to the Next public route.
- **No Subresource Integrity on the embed snippet, by design:** the snippet loads our own first-party `/embed/widget.js`, which is intentionally a mutable, versioned loader so config/runtime updates reach embedded sites without customers re-pasting. Pinning an `integrity=` hash would defeat that. Integrity is instead protected by serving over HTTPS from our own origin with appropriate cache headers.

---

## 10. Error handling

| Surface | Failure | Behavior |
|---|---|---|
| `widget.js` fetch | network/5xx | Inline "Couldn't load roles" with a quiet retry link; logged to console.warn only. |
| `widget.js` | widget disabled | Empty state copy ("No open roles right now"). |
| `widget.js` | 404 widget | Renders nothing visible (or a tiny commented note); no thrown error. |
| Public BFF route | upstream error | Pass through status; CORS headers still set. |
| Careers detail | invalid/closed position | `notFound()` → 404 page. |
| Apply form | field errors | Map FastAPI envelope `{message,data.code,details.errors}` onto fields via `setError`; non-field → top `Alert`. |
| Apply form | 429 / banned IP | Friendly "Too many submissions, try later" message. |
| Builder save | validation/server error | Toast + field errors; stay on form. |

---

## 11. Testing

**Backend (pytest):**
- `widget_repo`/`widget_service`: CRUD, duplicate, and the filtering+limit logic for `/{id}/data` (departments/locations/types/max_roles).
- Public data endpoint: active (filtered roles), disabled (empty + flag), missing (404).

**Frontend (vitest):**
- Pure functions: embed-snippet generation; config → theme CSS-variable mapping; client-side filter/search over roles.
- `widget.js` render: mount into a JSDOM fixture, assert Shadow DOM contents for each layout + empty/error/disabled states; assert multiple widgets coexist.
- Apply form zod schema: required/optional fields, file validation.
- Builder: control → preview/snippet wiring (light integration).

---

## 12. File map (new/changed)

**Backend**
```
schemas/widget_schema.py        (new)
repositories/widget_repo.py     (new)
services/widget_service.py      (new)
api/v1/widget_route.py          (new)
api/v1/__init__.py              (register router)
```

**Frontend**
```
src/app/api/widgets/[...path]/route.ts            (new — admin proxy)
src/app/api/public/widgets/[id]/route.ts          (new — public CORS proxy)
src/app/embed/widget.js/route.ts                  (new — runtime script)
src/lib/widget/runtime.ts                         (new — the IIFE source, bundled into the route)
src/lib/widget/snippet.ts                         (new — snippet generator, pure)
src/lib/widget/theme.ts                           (new — config → CSS vars, pure)
src/app/careers/page.tsx                          (new — public list)
src/app/careers/[id]/page.tsx                     (new — detail + apply)
src/app/careers/layout.tsx                        (new — public chrome)
src/lib/forms/schemas/application.ts              (new)
src/lib/forms/schemas/widget.ts                   (new)
src/app/dashboard/widgets/page.tsx                (new)
src/app/dashboard/widgets/loading.tsx             (new)
src/app/dashboard/widgets/[id]/edit/page.tsx      (new + preview/controls components)
src/components/widgets/...                         (new — controls, preview, snippet box, list)
src/lib/nav/items.ts                              (add Widgets)
src/lib/api/endpoints.ts                          (add widgets endpoints)
src/lib/query/keys.ts                             (add widgets keys)
middleware.ts                                     (allowlist public paths)
```

---

## 13. Open implementation notes (decide during planning, not blockers)
- Exact captcha provider wiring (Turnstile vs hCaptcha) is env-flagged and optional; default off in dev.
- Live preview iframe mechanism: pass the draft config to a preview route that runs the real runtime against an injected config object, so the preview is byte-faithful to production.
- Whether `widget.js` is hand-authored as a string or bundled from `src/lib/widget/runtime.ts` at build time (prefer bundling for testability, inline for simplicity — lean bundling).
