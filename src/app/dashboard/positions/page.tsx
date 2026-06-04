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

async function loadPositions(): Promise<Position[]> {
  const res = await serverFetch<ApiEnvelope<Position[]>>(
    "/api/positions/?start=0&stop=200",
  );
  return res.data?.data ?? [];
}

function distinctDepartments(positions: Position[]): string[] {
  const set = new Set<string>();
  for (const p of positions) {
    if (p.department && p.department.trim()) set.add(p.department.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export default async function PositionsPage() {
  const all = await loadPositions();
  const initialData = all.slice(0, 25);
  const departments = distinctDepartments(all);

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
