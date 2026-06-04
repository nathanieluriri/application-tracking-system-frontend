import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicantEditForm } from "@/components/applicants/ApplicantEditForm";
import { serverFetch } from "@/lib/api/server";
import type { Applicant } from "@/types/applicant";

interface ApiEnvelope<T> {
  data?: T;
}

async function loadApplicant(id: string): Promise<Applicant | null> {
  const res = await serverFetch<ApiEnvelope<Applicant>>(`/v1/applications/${id}`);
  if (res.status === 404) return null;
  return res.data?.data ?? null;
}

export default async function EditApplicantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const applicant = await loadApplicant(id);
  if (!applicant) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/applicants/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            Back to applicant
          </Link>
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">Edit {applicant.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          Update status, rating, and internal notes.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ApplicantEditForm applicant={applicant} />
        </CardContent>
      </Card>
    </div>
  );
}
