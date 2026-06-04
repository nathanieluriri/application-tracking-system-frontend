import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft, Pencil, MapPin, Briefcase, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PositionStatusBadge } from "@/components/positions/PositionStatusBadge";
import { serverFetch } from "@/lib/api/server";
import { employmentTypeLabel, type Position } from "@/types/position";

interface ApiEnvelope<T> {
  data?: T;
}

async function loadPosition(id: string): Promise<Position | null> {
  const res = await serverFetch<ApiEnvelope<Position>>(`/api/positions/${id}`);
  if (res.status === 404) return null;
  return res.data?.data ?? null;
}

export default async function PositionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const position = await loadPosition(id);
  if (!position) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/positions">
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            Back to positions
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href={`/dashboard/positions/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" aria-hidden />
            Edit
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <CardTitle className="text-2xl">{position.title}</CardTitle>
            <PositionStatusBadge status={position.status} />
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field icon={Building2} label="Department" value={position.department ?? "—"} />
            <Field icon={MapPin} label="Location" value={position.location ?? "—"} />
            <Field
              icon={Briefcase}
              label="Employment type"
              value={employmentTypeLabel(position.employment_type)}
            />
            <Field
              label="Created"
              value={
                position.date_created
                  ? format(new Date(position.date_created * 1000), "PPP")
                  : "—"
              }
            />
            <Field
              label="Last updated"
              value={
                position.last_updated
                  ? format(new Date(position.last_updated * 1000), "PPP p")
                  : "—"
              }
              className="sm:col-span-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            {position.requirements && position.requirements.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4">
                {position.requirements.map((r, i) => (
                  <li key={i} className="text-sm text-foreground">
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No requirements listed.</p>
            )}
          </CardContent>
        </Card>

        {position.description ? (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {position.description}
              </p>
            </CardContent>
          </Card>
        ) : null}
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
