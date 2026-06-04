import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { serverFetch } from "@/lib/api/server";
import type { Applicant } from "@/types/applicant";

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

export const dynamic = "force-dynamic";

async function loadApplicants(): Promise<Applicant[]> {
  const res = await serverFetch<ApiEnvelope<Applicant[]>>(
    "/api/applications/?start=0&stop=500",
  );
  return res.data?.data ?? [];
}

export default async function PipelinePage() {
  const applicants = await loadApplicants();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Drag applicants between stages to update their status.
        </p>
      </header>

      <PipelineBoard initialData={applicants} />
    </div>
  );
}
