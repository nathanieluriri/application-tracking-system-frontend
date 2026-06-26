import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PositionsTable } from "@/components/positions/PositionsTable";
import { serverFetch } from "@/lib/api/server";
import type { Position } from "@/types/position";

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

export const dynamic = "force-dynamic";

/**
 * Returns the positions list, or `null` when the server load FAILED (e.g. the
 * access-token cookie was mid-refresh and the in-process API returned 401/403).
 * The caller must treat `null` differently from `[]`: seeding an empty array as
 * the query's `initialData` would be cached as "fresh" (see `staleTime` in
 * QueryProvider) and suppress the client refetch, leaving the table empty even
 * though positions exist. On failure we seed nothing and let the client fetch.
 */
async function loadPositions(): Promise<Position[] | null> {
  const res = await serverFetch<ApiEnvelope<Position[]>>(
    "/api/positions/?start=0&stop=200",
  );
  if (res.data == null) return null;
  return res.data.data ?? [];
}

/** A URL search param equals its default (or is absent). */
function isDefaultParam(
  value: string | string[] | undefined,
  defaultValue: string,
): boolean {
  const v = Array.isArray(value) ? value[0] : value;
  return v === undefined || v === defaultValue;
}

function distinctDepartments(positions: Position[]): string[] {
  const set = new Set<string>();
  for (const p of positions) {
    if (p.department && p.department.trim()) set.add(p.department.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const loaded = await loadPositions();
  const all = loaded ?? [];
  const departments = distinctDepartments(all);

  // `initialData` is the unfiltered, page-1 slice, so it only matches the
  // DEFAULT query key. Seed it only for that exact view, and only when the
  // server load actually succeeded — never install [] from a failed load.
  const isDefaultView =
    isDefaultParam(sp.status, "all") &&
    isDefaultParam(sp.department, "all") &&
    isDefaultParam(sp.page, "1");
  const initialData = loaded && isDefaultView ? all.slice(0, 25) : undefined;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Positions</h1>
          <p className="text-sm text-muted-foreground">
            Manage open roles and their hiring pipelines.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/positions/new">Add position</Link>
        </Button>
      </header>

      <PositionsTable initialData={initialData} departments={departments} />
    </div>
  );
}
