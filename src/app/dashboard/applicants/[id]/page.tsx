import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft, Mail, Pencil, Phone, MapPin, Briefcase, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/applicants/StatusBadge";
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

export default async function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const applicant = await loadApplicant(id);
  if (!applicant) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/applicants">
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            Back to applicants
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/emails/compose?to=${id}`}>
              <Mail className="mr-2 h-4 w-4" aria-hidden />
              Email
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/dashboard/applicants/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl">{applicant.full_name}</CardTitle>
              <p className="text-sm text-muted-foreground">{applicant.email}</p>
            </div>
            <StatusBadge status={applicant.status} />
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field icon={Briefcase} label="Position" value={applicant.position_title ?? "—"} />
            <Field icon={MapPin} label="Location" value={applicant.location ?? "—"} />
            <Field icon={Phone} label="Phone" value={applicant.phone ?? "—"} />
            <Field
              icon={Star}
              label="Rating"
              value={applicant.rating ? `${applicant.rating}/5` : "Not rated"}
            />
            <Field
              label="Experience"
              value={applicant.experience ?? "—"}
              className="sm:col-span-2"
            />
            <Field
              label="Applied"
              value={
                applicant.applied_date
                  ? format(new Date(applicant.applied_date * 1000), "PPP")
                  : "—"
              }
            />
            <Field
              label="Last updated"
              value={
                applicant.last_updated
                  ? format(new Date(applicant.last_updated * 1000), "PPP p")
                  : "—"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Internal notes</CardTitle>
          </CardHeader>
          <CardContent>
            {applicant.notes ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {applicant.notes}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No notes yet. Add some from the edit page.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">CV</CardTitle>
          </CardHeader>
          <CardContent>
            {applicant.cv_document_id ? (
              <Button variant="outline" asChild>
                <Link
                  href={`/api/applications/${id}/cv`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View CV
                </Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">No CV attached.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-2 text-sm text-foreground">
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
        <span>{value}</span>
      </div>
    </div>
  );
}
