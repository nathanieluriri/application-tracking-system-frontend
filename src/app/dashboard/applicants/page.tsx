import { ApplicantsTable } from "@/components/applicants/ApplicantsTable";
import { serverFetch } from "@/lib/api/server";
import type { Applicant } from "@/types/applicant";

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

interface PositionLite {
  id?: string;
  _id?: string;
  title?: string;
  name?: string;
}

export const dynamic = "force-dynamic";

async function loadInitial(): Promise<Applicant[]> {
  const res = await serverFetch<ApiEnvelope<Applicant[]>>(
    "/v1/applications/?start=0&stop=25",
  );
  return res.data?.data ?? [];
}

async function loadPositions(): Promise<Array<{ id: string; label: string }>> {
  const res = await serverFetch<ApiEnvelope<PositionLite[]>>(
    "/v1/positions/?start=0&stop=200",
  );
  const items = res.data?.data ?? [];
  return items
    .map((p) => ({
      id: (p.id ?? p._id ?? "").toString(),
      label: p.title ?? p.name ?? "Untitled",
    }))
    .filter((p) => p.id);
}

export default async function ApplicantsPage() {
  const [applicants, positions] = await Promise.all([
    loadInitial(),
    loadPositions(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Applicants</h1>
        <p className="text-sm text-muted-foreground">
          Search, filter, and progress applicants through the pipeline.
        </p>
      </header>

      <ApplicantsTable initialData={applicants} positions={positions} />
    </div>
  );
}
