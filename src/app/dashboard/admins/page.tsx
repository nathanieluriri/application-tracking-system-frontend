import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminsList } from "@/components/admins/AdminsList";
import { serverFetch } from "@/lib/api/server";
import type { Admin } from "@/types/admin";

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

export const dynamic = "force-dynamic";

/**
 * Returns the admin list, or `null` when the server load FAILED — so we never
 * seed an empty array as "fresh" query data (which would suppress the client
 * refetch and leave the table looking empty). See the positions page for the
 * same pattern.
 */
async function loadAdmins(): Promise<Admin[] | null> {
  const res = await serverFetch<ApiEnvelope<Admin[]>>(
    "/api/admins/?start=0&stop=200",
  );
  if (res.data == null) return null;
  return res.data.data ?? [];
}

export default async function AdminsPage() {
  const loaded = await loadAdmins();
  const initialData = loaded ?? undefined;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admins</h1>
          <p className="text-sm text-muted-foreground">
            People with full access to this dashboard.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/admins/new">Add admin</Link>
        </Button>
      </header>

      <AdminsList initialData={initialData} />
    </div>
  );
}
