import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PositionForm } from "@/components/positions/PositionForm";
import { serverFetch } from "@/lib/api/server";
import type { Position } from "@/types/position";

interface ApiEnvelope<T> {
  data?: T;
}

async function loadPosition(id: string): Promise<Position | null> {
  const res = await serverFetch<ApiEnvelope<Position>>(`/api/positions/${id}`);
  if (res.status === 404) return null;
  return res.data?.data ?? null;
}

export default async function EditPositionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const position = await loadPosition(id);
  if (!position) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/positions/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            Back to position
          </Link>
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">Edit {position.title}</h1>
        <p className="text-sm text-muted-foreground">
          Update the role details, status, and requirements.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <PositionForm position={position} />
        </CardContent>
      </Card>
    </div>
  );
}
