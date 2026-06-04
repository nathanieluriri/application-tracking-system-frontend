# Loading-States UX Hardening + Next 16 Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the frontend to Next 16, then make the whole app abide by sound loading-state UX (native top nav progress bar, determinate progress UI, reduced-motion, anti-flash/anti-flicker timing, no bare full-page spinners), and correct the docs.

**Architecture:** Focused primitives + thin hooks in the existing `components/feedback/*` / `hooks/` style — no global loading store. The Next 16 upgrade is an isolated Phase 0 that must be verified green before any UX work. Navigation feedback uses the native `onNavigate` Link prop bridged into a React context that drives a fixed top bar.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19.2, TypeScript, Tailwind, shadcn/ui, `@radix-ui/react-progress`, TanStack Query, sonner. Package manager: **bun** (per `CLAUDE.md` §12).

---

## Conventions for this plan

- **No unit-test runner exists** (per the approved spec §7 — `package.json` has only `dev`/`build`/`start`/`lint`/`typecheck`, and we are intentionally not adding one). So each task's verification step uses **typecheck + lint + (build where relevant) + a concrete manual check with an expected observable result**, in place of the usual TDD test loop.
- **Verification commands:**
  - Typecheck: `bunx tsc --noEmit` → expected: no output, exit 0.
  - Lint (after Task 0.2 sets it up): `bun run lint` → expected: no errors.
  - Build: `bun run build` → expected: "Compiled successfully".
- **Commits:** the frontend folder is its own git repo. Every commit message must end with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Branch:** all work happens on the branch created in Task 0.0, not on the default branch.
- **Manual walkthrough requires the FastAPI backend running** (the dashboard layout server-fetches `/v1/admins/profile`, and the proxy auth-gate needs a valid `access_token` cookie). Ensure the backend is up and you can log in before the manual checks. If the backend is unavailable, do the code/typecheck/lint/build checks and defer the visual nav-bar/upload checks.

---

## Phase 0 — Next 16 upgrade (isolated; must be green before Phase 1)

> Optional accelerator: you may run `bunx @next/codemod@canary upgrade latest` first to automate the mechanical edits (deps, `next lint`→eslint, `middleware`→`proxy`, config). The tasks below specify the exact desired **end state** regardless of whether the codemod ran, so apply them as verification + fill-in.

### Task 0.0: Create the working branch

**Files:** none (git only)

- [ ] **Step 1: Confirm a clean tree and branch**

Run:
```bash
git status
git checkout -b feat/loading-states-and-next16
```
Expected: a new branch `feat/loading-states-and-next16` is checked out. If there are pre-existing uncommitted changes you didn't make, stop and ask before continuing.

### Task 0.1: Bump to Next 16 / React 19.2

**Files:**
- Modify: `package.json` (dependency versions)

- [ ] **Step 1: Confirm Node ≥ 20.9**

Run: `node -v`
Expected: `v20.9.0` or higher (dev box is `v20.19.5`). If lower, stop — Next 16 requires Node 20.9+.

- [ ] **Step 2: Upgrade runtime deps**

Run:
```bash
bun add next@latest react@latest react-dom@latest
bun add -d @types/react@latest @types/react-dom@latest
```

- [ ] **Step 3: Verify installed versions**

Run: `bun pm ls | grep -E "next@|react@|react-dom@"` (or open `package.json`)
Expected: `next@16.x`, `react@19.2.x`, `react-dom@19.2.x`.

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: upgrade to Next 16 and React 19.2"
```
(Note: `bun.lock` is created by the install if it didn't exist; include it.)

### Task 0.2: Replace `next lint` with an ESLint flat config

`next lint` is removed in Next 16, and the project currently has **no** eslint dependency or config.

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json` (devDeps + `lint` script)

- [ ] **Step 1: Add ESLint deps**

Run:
```bash
bun add -d eslint eslint-config-next @eslint/eslintrc
```

- [ ] **Step 2: Create `eslint.config.mjs`**

```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
```

- [ ] **Step 3: Point the `lint` script at the ESLint CLI**

In `package.json`, change:
```json
"lint": "next lint",
```
to:
```json
"lint": "eslint .",
```

- [ ] **Step 4: Run lint**

Run: `bun run lint`
Expected: ESLint runs (no "next lint is removed" error). Fix any real errors it reports in existing files; warnings are acceptable.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs package.json bun.lock
git commit -m "chore: migrate from next lint to ESLint flat config"
```

### Task 0.3: Rename `middleware.ts` → `proxy.ts`

The `middleware` file/convention is deprecated in 16 (renamed to `proxy`, `nodejs` runtime). The logic is cookie-redirect only, so `nodejs` runtime is safe.

**Files:**
- Create: `proxy.ts`
- Delete: `middleware.ts`

- [ ] **Step 1: Create `proxy.ts`** (identical logic, function renamed `middleware` → `proxy`)

```ts
import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "access_token";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/static",
  "/images",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const access = req.cookies.get(ACCESS_COOKIE)?.value;

  if (isPublic(pathname)) {
    if (access && PUBLIC_PATHS.includes(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard/overview";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!access) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
  ],
};
```

- [ ] **Step 2: Delete the old file**

Run: `git rm middleware.ts`

- [ ] **Step 3: Verify no other references to "middleware" in source**

Run: `grep -rn "middleware" src/ proxy.ts` (the CLAUDE.md doc references are handled in Task 0.5)
Expected: no code references that break (the matcher `config` export stays the same).

- [ ] **Step 4: Commit**

```bash
git add proxy.ts
git commit -m "refactor: rename middleware to proxy for Next 16"
```

### Task 0.4: Clean up `next.config.ts`

`typedRoutes` is stable/top-level in 16 and is currently `false`, so just remove the experimental block.

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "chore: drop stale experimental.typedRoutes from next.config"
```

### Task 0.5: Update `CLAUDE.md` middleware → proxy references

**Files:**
- Modify: `CLAUDE.md` (§1 and anywhere "middleware" is named)

- [ ] **Step 1: Find every reference**

Run: `grep -n "middleware" CLAUDE.md`

- [ ] **Step 2: Update wording**

Replace `` `middleware.ts` `` with `` `proxy.ts` `` and phrases like "middleware.ts is the auth gate" with "`proxy.ts` is the auth gate". Update the bullet "**Real auth is enforced by FastAPI ... Middleware is optimistic ...**" to say "The proxy is optimistic". Keep all surrounding meaning intact.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update middleware references to proxy"
```

### Task 0.6: Phase 0 verify gate

**Files:** none (verification; commit any fixes)

- [ ] **Step 1: Typecheck**

Run: `bunx tsc --noEmit`
Expected: exit 0, no errors. (Async `params`/`cookies`/`headers` are already adopted, so none expected.)

- [ ] **Step 2: Lint**

Run: `bun run lint`
Expected: no errors.

- [ ] **Step 3: Production build (Turbopack default)**

Run: `bun run build`
Expected: "Compiled successfully". No "webpack config found" error (there is no custom webpack config).

- [ ] **Step 4: Manual auth-flow check** (backend running)

Run: `bun dev`, then in the browser:
- Visit `/dashboard/overview` while logged out → expect redirect to `/login?next=...` (proxy working).
- Log in → expect to land on the dashboard, which renders (layout profile fetch ok).

- [ ] **Step 5: Commit any fixes** (if needed)

```bash
git add -A
git commit -m "fix: resolve Next 16 build/typecheck issues"
```

---

## Phase 1 — Native top navigation progress bar

### Task 1.1: NavigationProgress provider + top bar

**Files:**
- Create: `src/providers/NavigationProgress.tsx`

- [ ] **Step 1: Create the provider + bar**

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavigationProgressContextValue {
  start: () => void;
  done: () => void;
}

const NavigationProgressContext =
  createContext<NavigationProgressContextValue | null>(null);

export function useNavigationProgress(): NavigationProgressContextValue {
  const ctx = useContext(NavigationProgressContext);
  if (!ctx) {
    throw new Error(
      "useNavigationProgress must be used within NavigationProgressProvider",
    );
  }
  return ctx;
}

const SAFETY_TIMEOUT_MS = 10_000;
const TRICKLE_INTERVAL_MS = 400;
const FADE_OUT_MS = 250;

export function NavigationProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  // null = hidden; otherwise 0..100
  const [progress, setProgress] = useState<number | null>(null);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const clearTimers = useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (safetyRef.current) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
  }, []);

  const done = useCallback(() => {
    clearTimers();
    setProgress((p) => (p === null ? null : 100));
    if (fadeRef.current) clearTimeout(fadeRef.current);
    fadeRef.current = setTimeout(() => setProgress(null), FADE_OUT_MS);
  }, [clearTimers]);

  const start = useCallback(() => {
    if (fadeRef.current) {
      clearTimeout(fadeRef.current);
      fadeRef.current = null;
    }
    clearTimers();
    setProgress(8);
    trickleRef.current = setInterval(() => {
      setProgress((p) => {
        if (p === null) return null;
        if (p >= 90) return p; // creep; never hit 100 until done()
        return p + Math.max(1, (90 - p) * 0.1);
      });
    }, TRICKLE_INTERVAL_MS);
    safetyRef.current = setTimeout(() => done(), SAFETY_TIMEOUT_MS);
  }, [clearTimers, done]);

  // Complete when the route (pathname) actually changes. Also runs on mount
  // (harmless: progress is null, so done() is a no-op).
  useEffect(() => {
    done();
  }, [pathname, done]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      clearTimers();
      if (fadeRef.current) clearTimeout(fadeRef.current);
    },
    [clearTimers],
  );

  const visible = progress !== null;

  return (
    <NavigationProgressContext.Provider value={{ start, done }}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
      >
        <div
          className={cn(
            "h-full bg-primary transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none",
            visible ? "opacity-100" : "opacity-0",
          )}
          style={{ width: `${progress ?? 0}%` }}
        />
      </div>
      {children}
    </NavigationProgressContext.Provider>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/providers/NavigationProgress.tsx
git commit -m "feat: add NavigationProgress provider and top bar"
```

### Task 1.2: NavLink wrapper (native `onNavigate`)

**Files:**
- Create: `src/components/layout/NavLink.tsx`

- [ ] **Step 1: Create the wrapper**

```tsx
"use client";

import Link from "next/link";
import { type ComponentProps } from "react";
import { useNavigationProgress } from "@/providers/NavigationProgress";

type NavLinkProps = ComponentProps<typeof Link>;

/**
 * Drop-in for next/link that starts the top navigation progress bar on
 * client-side navigation via the native `onNavigate` prop.
 */
export function NavLink({ onNavigate, ...props }: NavLinkProps) {
  const { start } = useNavigationProgress();
  return (
    <Link
      {...props}
      onNavigate={(event) => {
        start();
        onNavigate?.(event);
      }}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: exit 0. (If `onNavigate` is not found on `ComponentProps<typeof Link>`, confirm `next@16` is installed from Task 0.1.)

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/NavLink.tsx
git commit -m "feat: add NavLink wrapper driving the nav progress bar"
```

### Task 1.3: `useNavigate` hook for post-mutation redirects

**Files:**
- Create: `src/hooks/useNavigate.ts`

- [ ] **Step 1: Create the hook**

```ts
"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useNavigationProgress } from "@/providers/NavigationProgress";

/**
 * Wraps router.push/replace so programmatic navigation (e.g. after a mutation)
 * also drives the top progress bar. Use inside the dashboard subtree only,
 * where NavigationProgressProvider is mounted.
 */
export function useNavigate() {
  const router = useRouter();
  const { start } = useNavigationProgress();

  const push = useCallback(
    (href: string) => {
      start();
      router.push(href);
    },
    [router, start],
  );

  const replace = useCallback(
    (href: string) => {
      start();
      router.replace(href);
    },
    [router, start],
  );

  return { push, replace, router };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `bunx tsc --noEmit` (expected exit 0), then:
```bash
git add src/hooks/useNavigate.ts
git commit -m "feat: add useNavigate hook for progress-aware redirects"
```

### Task 1.4: Wire the provider + swap sidebar links

**Files:**
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/components/layout/DashboardSidebar.tsx`

- [ ] **Step 1: Wrap the dashboard layout with the provider**

In `src/app/dashboard/layout.tsx`, add the import and wrap the returned tree:

```tsx
import { ReactNode } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { serverFetch } from "@/lib/api/server";
import { NavigationProgressProvider } from "@/providers/NavigationProgress";
```

and change the `return (...)` to:

```tsx
  return (
    <NavigationProgressProvider>
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar user={user} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar user={user} />
          <main className="flex-1 px-4 md:px-8 py-6 md:py-8">{children}</main>
        </div>
      </div>
    </NavigationProgressProvider>
  );
```

- [ ] **Step 2: Swap `<Link>` → `<NavLink>` in the sidebar**

In `src/components/layout/DashboardSidebar.tsx`:
- Replace `import Link from "next/link";` with `import { NavLink } from "@/components/layout/NavLink";`
- In the `NAV_ITEMS.map(...)`, change the opening `<Link` to `<NavLink` and the closing `</Link>` to `</NavLink>`. Leave every prop and child unchanged.

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual check** (backend running)

Run `bun dev`, log in, click between sidebar items (Overview ↔ Applicants ↔ Emails).
Expected: a thin green bar appears at the very top on click, trickles, and completes/fades when the new route renders. It never stays stuck.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/layout.tsx src/components/layout/DashboardSidebar.tsx
git commit -m "feat: wire navigation progress bar into the dashboard"
```

### Task 1.5 (optional): inline per-link spinner via `useLinkStatus`

> Optional nicety; skip if time-constrained. Adds an inline spinner on the clicked sidebar item.

**Files:**
- Modify: `src/components/layout/NavLink.tsx` (or a small child component)

- [ ] **Step 1: Add an inline pending indicator**

Inside `NavLink`, render a child that reads `useLinkStatus()` (from `next/link`) and shows a small `Loader2` spinner when `pending` is true. `useLinkStatus` must be called in a component nested **inside** `<Link>`, e.g.:

```tsx
"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { type ComponentProps, type ReactNode } from "react";
import { useNavigationProgress } from "@/providers/NavigationProgress";

function PendingDot() {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin motion-reduce:hidden" aria-hidden />
  ) : null;
}

type NavLinkProps = ComponentProps<typeof Link> & { children?: ReactNode };

export function NavLink({ onNavigate, children, ...props }: NavLinkProps) {
  const { start } = useNavigationProgress();
  return (
    <Link
      {...props}
      onNavigate={(event) => {
        start();
        onNavigate?.(event);
      }}
    >
      {children}
      <PendingDot />
    </Link>
  );
}
```

- [ ] **Step 2: Typecheck + manual check + commit**

Run: `bunx tsc --noEmit` (expected exit 0). Manually confirm the clicked item shows a tiny spinner during navigation. Then:
```bash
git add src/components/layout/NavLink.tsx
git commit -m "feat: inline pending spinner on sidebar links via useLinkStatus"
```

---

## Phase 2 — Determinate progress (real, reusable UI)

### Task 2.1: `Progress` primitive (shadcn over Radix)

**Files:**
- Create: `src/components/ui/progress.tsx`

- [ ] **Step 1: Create the primitive**

```tsx
"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-muted",
      className,
    )}
    value={value}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none"
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
```

Note: Radix sets `role="progressbar"` and `aria-valuemin/max/now` automatically when `value` is a number; passing `value={undefined}` yields an indeterminate bar (the fallback for unknown total size).

- [ ] **Step 2: Typecheck + commit**

Run: `bunx tsc --noEmit` (expected exit 0), then:
```bash
git add src/components/ui/progress.tsx
git commit -m "feat: add shadcn Progress primitive over radix-progress"
```

### Task 2.2: `useUploadWithProgress` hook (XHR, real %)

**Files:**
- Create: `src/hooks/useUploadWithProgress.ts`

- [ ] **Step 1: Create the hook**

```ts
"use client";

import { useCallback, useRef, useState } from "react";

export type UploadStatus =
  | "idle"
  | "uploading"
  | "success"
  | "error"
  | "canceled";

export interface UploadResult<T = unknown> {
  status: number;
  data: T | null;
}

export interface UseUploadOptions {
  /** BFF path, e.g. "/api/documents/upload". Never call FastAPI directly. */
  url: string;
  method?: "POST" | "PUT" | "PATCH";
}

export interface UseUploadReturn<T> {
  progress: number; // 0..100
  determinate: boolean; // false when total size is unknown
  status: UploadStatus;
  error: string | null;
  result: T | null;
  upload: (
    file: File,
    fieldName?: string,
    extra?: Record<string, string>,
  ) => Promise<UploadResult<T>>;
  cancel: () => void;
  reset: () => void;
}

export function useUploadWithProgress<T = unknown>({
  url,
  method = "POST",
}: UseUploadOptions): UseUploadReturn<T> {
  const [progress, setProgress] = useState(0);
  const [determinate, setDeterminate] = useState(true);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    setProgress(0);
    setDeterminate(true);
    setStatus("idle");
    setError(null);
    setResult(null);
  }, []);

  const cancel = useCallback(() => {
    xhrRef.current?.abort();
  }, []);

  const upload = useCallback(
    (file: File, fieldName = "file", extra?: Record<string, string>) =>
      new Promise<UploadResult<T>>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        const form = new FormData();
        form.append(fieldName, file);
        if (extra) {
          for (const [k, v] of Object.entries(extra)) form.append(k, v);
        }

        setStatus("uploading");
        setError(null);
        setProgress(0);
        setResult(null);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setDeterminate(true);
            setProgress(Math.round((e.loaded / e.total) * 100));
          } else {
            setDeterminate(false);
          }
        };

        xhr.onload = () => {
          let data: T | null = null;
          try {
            data = JSON.parse(xhr.responseText) as T;
          } catch {
            data = null;
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            setStatus("success");
            setProgress(100);
            setResult(data);
            resolve({ status: xhr.status, data });
          } else {
            const msg =
              (data as unknown as { message?: string } | null)?.message ??
              `Upload failed (${xhr.status})`;
            setStatus("error");
            setError(msg);
            reject(Object.assign(new Error(msg), { status: xhr.status }));
          }
        };

        xhr.onerror = () => {
          setStatus("error");
          setError("Network error during upload");
          reject(new Error("Network error during upload"));
        };

        xhr.onabort = () => {
          setStatus("canceled");
          setError(null);
          reject(Object.assign(new Error("Upload canceled"), { canceled: true }));
        };

        xhr.open(method, url);
        xhr.withCredentials = true; // forward auth cookies through the BFF
        xhr.setRequestHeader("accept", "application/json");
        xhr.send(form);
      }),
    [url, method],
  );

  return { progress, determinate, status, error, result, upload, cancel, reset };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `bunx tsc --noEmit` (expected exit 0), then:
```bash
git add src/hooks/useUploadWithProgress.ts
git commit -m "feat: add XHR-based useUploadWithProgress hook"
```

### Task 2.3: Add `decorative` mode to `Spinner` (foundational primitive)

Used by `UploadProgress` (Task 2.4), `LoadingOverlay` (Task 3.2), and `BrandedSplash` (Task 5.1) so a spinner placed inside a component that already owns an `aria-live` region doesn't announce twice. Done here (before `UploadProgress`) so every later task stays typecheck-clean.

**Files:**
- Modify: `src/components/feedback/Spinner.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  /**
   * When true, render only the icon with no role/live-region/label — for use
   * inside a component that already provides its own live region.
   */
  decorative?: boolean;
  label?: string;
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

export function Spinner({
  className,
  size = "md",
  decorative = false,
  label = "Loading…",
  ...props
}: SpinnerProps) {
  const icon = (
    <Loader2
      className={cn("animate-spin text-muted-foreground", sizeMap[size], className)}
    />
  );

  if (decorative) {
    return (
      <div aria-hidden {...props}>
        {icon}
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" {...props}>
      {icon}
      <span className="sr-only">{label}</span>
    </div>
  );
}
```

> The spinner intentionally keeps spinning under reduced motion (it is essential, functional feedback). Only decorative/ambient motion is suppressed elsewhere.

- [ ] **Step 2: Typecheck + commit**

Run: `bunx tsc --noEmit` (expected exit 0), then:
```bash
git add src/components/feedback/Spinner.tsx
git commit -m "feat: add decorative mode to Spinner for nested live regions"
```

### Task 2.4: `UploadProgress` presentational component

**Files:**
- Create: `src/components/feedback/UploadProgress.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/feedback/Spinner";
import { cn } from "@/lib/utils";
import type { UploadStatus } from "@/hooks/useUploadWithProgress";

interface UploadProgressProps {
  fileName?: string;
  progress: number;
  determinate: boolean;
  status: UploadStatus;
  error?: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

export function UploadProgress({
  fileName,
  progress,
  determinate,
  status,
  error,
  onCancel,
  onRetry,
  className,
}: UploadProgressProps) {
  const isUploading = status === "uploading";
  const label =
    status === "success"
      ? "Done"
      : status === "error"
        ? "Failed"
        : status === "canceled"
          ? "Canceled"
          : determinate
            ? `${progress}%`
            : "Uploading…";

  return (
    <div className={cn("space-y-3 rounded-lg border p-4", className)} aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {isUploading ? <Spinner size="sm" decorative /> : null}
          <span className="truncate text-sm font-medium">{fileName ?? "File"}</span>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      </div>

      <Progress
        value={determinate ? progress : undefined}
        className={cn(status === "error" && "[&>div]:bg-destructive")}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {(isUploading && onCancel) || (status === "error" && onRetry) ? (
        <div className="flex justify-end gap-2">
          {isUploading && onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {status === "error" && onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `bunx tsc --noEmit` (expected exit 0), then:
```bash
git add src/components/feedback/UploadProgress.tsx
git commit -m "feat: add UploadProgress component (progress + cancel/retry)"
```

---

## Phase 3 — Timing discipline (anti-flash + anti-flicker)

### Task 3.1: `useDelayedFlag` hook

**Files:**
- Create: `src/hooks/useDelayedFlag.ts`

- [ ] **Step 1: Create the hook**

```ts
"use client";

import { useEffect, useRef, useState } from "react";

interface DelayedFlagOptions {
  /** Wait this long while active before turning on (anti-flash). Default 200ms. */
  delay?: number;
  /** Once on, stay on at least this long (anti-flicker). Default 400ms. */
  minDuration?: number;
}

/**
 * Returns a boolean that turns on only after `active` has been true for `delay`,
 * and once on stays on for at least `minDuration`. Prevents loader flash on fast
 * responses and flash-and-vanish flicker on borderline ones.
 */
export function useDelayedFlag(
  active: boolean,
  { delay = 200, minDuration = 400 }: DelayedFlagOptions = {},
): boolean {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const shownAtRef = useRef(0);

  const show = () => {
    visibleRef.current = true;
    shownAtRef.current = performance.now();
    setVisible(true);
  };
  const hide = () => {
    visibleRef.current = false;
    setVisible(false);
  };

  useEffect(() => {
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (active) {
      if (!visibleRef.current) {
        delayTimer = setTimeout(show, delay);
      }
    } else if (visibleRef.current) {
      const elapsed = performance.now() - shownAtRef.current;
      const remaining = Math.max(0, minDuration - elapsed);
      hideTimer = setTimeout(hide, remaining);
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [active, delay, minDuration]);

  return visible;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `bunx tsc --noEmit` (expected exit 0), then:
```bash
git add src/hooks/useDelayedFlag.ts
git commit -m "feat: add useDelayedFlag timing hook"
```

### Task 3.2: Bake timing into `LoadingOverlay` (+ single live region)

> This also resolves the double `aria-live` (the Phase 4 a11y item) by using a single live region with a decorative spinner. Requires `Spinner.decorative` (added in Task 2.3, already done by this point).

**Files:**
- Modify: `src/components/feedback/LoadingOverlay.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";

interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  visible: boolean;
  message?: string;
  /** Delay before showing (anti-flash). Default 200ms. */
  delay?: number;
  /** Minimum time shown once visible (anti-flicker). Default 400ms. */
  minDuration?: number;
}

export function LoadingOverlay({
  visible,
  message,
  delay,
  minDuration,
  className,
  ...props
}: LoadingOverlayProps) {
  const show = useDelayedFlag(visible, { delay, minDuration });
  if (!show) return null;
  return (
    <div
      aria-busy="true"
      className={cn(
        "absolute inset-0 z-10 grid place-items-center rounded-lg bg-background/60 backdrop-blur-sm",
        className,
      )}
      {...props}
    >
      <div
        className="flex flex-col items-center gap-2"
        role="status"
        aria-live="polite"
      >
        <Spinner size="md" decorative />
        {message ? (
          <span className="text-sm text-muted-foreground">{message}</span>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `bunx tsc --noEmit` (expected exit 0), then:
```bash
git add src/components/feedback/LoadingOverlay.tsx
git commit -m "feat: add timing discipline + single live region to LoadingOverlay"
```

---

## Phase 4 — Reduced motion + a11y polish

> The a11y double-`aria-live` fix lands via `Spinner.decorative` (Task 2.3) plus the single live region in `LoadingOverlay` (Task 3.2). What remains for this phase is skeleton reduced-motion.

### Task 4.1: Reduced-motion for skeletons (primitive only — DRY)

**Files:**
- Modify: `src/components/ui/skeleton.tsx`

- [ ] **Step 1: Replace the file** (every skeleton inherits this)

```tsx
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
```

- [ ] **Step 2: Manual check**

In DevTools (Rendering → "Emulate CSS prefers-reduced-motion: reduce"), load a route with a skeleton (e.g. `/dashboard/applicants`).
Expected: skeleton blocks are static (no pulse) under reduced motion; normal pulse otherwise.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/skeleton.tsx
git commit -m "feat: respect prefers-reduced-motion in Skeleton"
```

---

## Phase 5 — Full-page / root fixes

### Task 5.1: Branded splash replaces the root bare spinner

**Files:**
- Create: `src/components/feedback/BrandedSplash.tsx`
- Modify: `src/app/loading.tsx`
- Delete: `src/components/feedback/PageLoader.tsx`

- [ ] **Step 1: Create the branded splash**

```tsx
import { Briefcase } from "lucide-react";
import { Spinner } from "./Spinner";

export function BrandedSplash() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div
        className="flex flex-col items-center gap-4"
        role="status"
        aria-live="polite"
      >
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Briefcase className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium">ATS</p>
        <Spinner size="sm" decorative />
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Point root `loading.tsx` at it**

Replace `src/app/loading.tsx` contents:

```tsx
import { BrandedSplash } from "@/components/feedback/BrandedSplash";

export default function Loading() {
  return <BrandedSplash />;
}
```

- [ ] **Step 3: Delete the bare-spinner `PageLoader`** (its only importer was `app/loading.tsx`)

Run: `grep -rn "PageLoader" src/` → expected: no matches after Step 2. Then:
```bash
git rm src/components/feedback/PageLoader.tsx
```

- [ ] **Step 4: Typecheck + commit**

Run: `bunx tsc --noEmit` (expected exit 0), then:
```bash
git add src/components/feedback/BrandedSplash.tsx src/app/loading.tsx
git commit -m "feat: branded splash for root loading; remove bare PageLoader"
```

### Task 5.2: Auth-group loading skeleton

**Files:**
- Create: `src/app/(auth)/loading.tsx`

- [ ] **Step 1: Create the auth skeleton** (mirrors the login `<Card>` inside the `max-w-md` auth layout)

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <Skeleton className="mx-auto h-6 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `bunx tsc --noEmit` (expected exit 0), then:
```bash
git add "src/app/(auth)/loading.tsx"
git commit -m "feat: add auth-group loading skeleton"
```

---

## Phase 6 — Compliance sweep + docs

### Task 6.1: `AsyncBoundary` helper for future client queries

**Files:**
- Create: `src/components/feedback/AsyncBoundary.tsx`

- [ ] **Step 1: Create the helper**

```tsx
"use client";

import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface AsyncBoundaryProps {
  /** Pass query.isLoading (initial load, no data) — NOT isFetching — so background
   *  refetches keep showing existing data instead of flashing the skeleton. */
  isLoading: boolean;
  isError: boolean;
  isEmpty?: boolean;
  error?: unknown;
  onRetry?: () => void;
  skeleton: ReactNode;
  empty?: ReactNode;
  children: ReactNode;
}

export function AsyncBoundary({
  isLoading,
  isError,
  isEmpty,
  error,
  onRetry,
  skeleton,
  empty,
  children,
}: AsyncBoundaryProps) {
  if (isLoading) return <>{skeleton}</>;
  if (isError) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
      >
        <p className="text-sm text-destructive">{message}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <>{empty ?? <p className="text-sm text-muted-foreground">Nothing here yet.</p>}</>
    );
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `bunx tsc --noEmit` (expected exit 0), then:
```bash
git add src/components/feedback/AsyncBoundary.tsx
git commit -m "feat: add AsyncBoundary for client-query loading/error/empty"
```

### Task 6.2: Rewrite `CLAUDE.md` §3 + remove orphaned CSS

**Files:**
- Modify: `CLAUDE.md` (§3 Loading & feedback rules)
- Modify: `src/styles/globals.css` (remove unused `.nav-progress`)

- [ ] **Step 1: Replace the §3 table/section** with the corrected, expanded rules:

```markdown
## 3. Loading & feedback rules

Every interaction that waits on a network response must give visible feedback. Pick the right kind:

| Situation | Required feedback |
|---|---|
| Cold-loading a page | A `loading.tsx` skeleton matching the page shape (table → `TableSkeleton`, KPI grid → `KpiGridSkeleton`, form → `FormSkeleton`). **Never a bare spinner for a full page.** The root `app/loading.tsx` uses `<BrandedSplash>`, not a spinner. |
| Warm route navigation | The top progress bar, driven by `NavigationProgressProvider` (wrapped around the dashboard layout). Sidebar links use `<NavLink>` (native `onNavigate`); post-mutation redirects use `useNavigate()` so the bar shows for `router.push` too. |
| Form submit / button awaiting response | `<ButtonLoading>` — disabled + inline spinner + label change ("Saving…"). |
| Mutation updating a card/section | `<LoadingOverlay visible>` over the affected card. It self-delays (anti-flash) and self-holds (anti-flicker) via `useDelayedFlag`. |
| Finite work with known progress | `<Progress>` (determinate). For uploads use `useUploadWithProgress` + `<UploadProgress>` (real %, cancel, retry). Use an indeterminate `<Progress>` (no `value`) only when total size is unknown. |
| Client query (list/detail) | Wrap render in `<AsyncBoundary>`: `isLoading` → skeleton, `isError` → message + retry, `isEmpty` → empty state. Pass `query.isLoading` (NOT `isFetching`) so background refetches don't replace content. |
| Toggle / star / archive | Optimistic UI immediately; roll back on error; sonner toast on success/failure. |

**Accessibility & timing principles (apply everywhere):**
- Respect `prefers-reduced-motion`: skeletons stop pulsing (`motion-reduce:animate-none`), the nav bar stops easing. The spinner keeps spinning — it is essential feedback.
- One live region per loader. `Spinner` owns a `role="status"` region by default; inside a component that already has one, use `<Spinner decorative />`.
- Don't flash loaders for sub-perceptible waits, and don't flicker them off instantly — `LoadingOverlay` and other spinner feedback use `useDelayedFlag` (≈200ms delay, ≈400ms minimum).

**Skeletons live in `components/feedback/skeletons/`.** When you create a new list/detail/form component, create a sibling skeleton with matching dimensions.
```

- [ ] **Step 2: Remove the orphaned `.nav-progress` utility** from `src/styles/globals.css` — delete the entire block:

```css
@layer utilities {
  .nav-progress {
    background-image: linear-gradient(
      90deg,
      transparent,
      hsl(var(--primary)) 50%,
      transparent
    );
    background-size: 200% 100%;
  }
}
```

- [ ] **Step 3: Also update the §11 "never" bullet** if present — ensure "Never block a route with a generic spinner when a skeleton would fit" remains and reads correctly.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md src/styles/globals.css
git commit -m "docs: rewrite loading rules to match implementation; drop orphan CSS"
```

### Task 6.3: Final verification sweep

**Files:** none (verification)

- [ ] **Step 1: Typecheck, lint, build**

Run:
```bash
bunx tsc --noEmit
bun run lint
bun run build
```
Expected: all clean / "Compiled successfully".

- [ ] **Step 2: Full manual walkthrough** (backend running, `bun dev`)

- Warm sidebar navigation → top bar appears, trickles, completes; never stuck.
- DevTools reduced-motion → skeletons static, bar non-eased, spinner still spins.
- A slow mutation surfaced via `<LoadingOverlay visible>` shows after a beat without flicker; a near-instant one does not flash. (Exercise on any component wired to it; if none yet, verify on a temporary harness or defer.)
- `<UploadProgress>` with a throttled connection (DevTools Network throttling) shows a climbing %, and cancel/retry both work. (Verify on a temporary harness if no upload screen exists yet.)
- Root cold load shows the branded splash, not a bare spinner; auth routes show the card skeleton.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in final loading-states walkthrough"
```

---

## Self-review

**1. Spec coverage** (each spec §5 phase → task):
- Phase 0 (Next 16): Tasks 0.0–0.6 (deps, ESLint, middleware→proxy, config, docs, verify). ✓
- Phase 1 (nav bar): Tasks 1.1–1.4, optional 1.5. ✓
- Phase 2 (determinate progress): Tasks 2.1–2.4 (Progress primitive, upload hook, `Spinner.decorative`, `UploadProgress`). ✓
- Phase 3 (timing): Tasks 3.1–3.2. ✓
- Phase 4 (reduced motion + a11y): skeleton reduced-motion (Task 4.1); the double-`aria-live` a11y fix is realized via `Spinner.decorative` (Task 2.3) + `LoadingOverlay` (Task 3.2). ✓
- Phase 5 (root fixes): Tasks 5.1–5.2. ✓
- Phase 6 (compliance + docs): Tasks 6.1–6.3 (AsyncBoundary, CLAUDE.md §3, verify). ✓
- Determinate-progress rule added to CLAUDE.md → Task 6.2 table row. ✓

**2. Placeholder scan:** No "TBD"/"handle errors"/"similar to" — every code step shows full content. The two "verify on a temporary harness if no screen exists yet" notes are explicit consequences of the approved non-goal (not building stub features), not placeholders.

**3. Type consistency:**
- `useNavigationProgress(): { start, done }` — consumed by `NavLink` (`start`) and `useNavigate` (`start`). ✓
- `NavigationProgressProvider` — imported in `dashboard/layout.tsx`. ✓
- `Spinner` `decorative`/`label` props — added in Task 2.3, used in 2.4 (UploadProgress), 3.2 (LoadingOverlay), 5.1 (BrandedSplash). ✓
- `useUploadWithProgress` return shape ↔ `UploadProgress` props (`progress`, `determinate`, `status`, `error`) — aligned; `UploadStatus` imported by the component from the hook. ✓
- `useDelayedFlag(active, opts): boolean` — used by `LoadingOverlay`. ✓
- `Progress` `value?: number` — `UploadProgress` passes `value={determinate ? progress : undefined}`. ✓
- `BrandedSplash` replaces `PageLoader`; `app/loading.tsx` import updated; `PageLoader` deleted with no remaining importers. ✓

**Cross-phase dependency note:** `Spinner.decorative` is introduced in Task 2.3 — before its first consumer `UploadProgress` (2.4), and before `LoadingOverlay` (3.2) and `BrandedSplash` (5.1). Every task therefore typechecks in order with no forward references.
