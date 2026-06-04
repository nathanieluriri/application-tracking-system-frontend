import { ReactNode } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { serverFetch } from "@/lib/api/server";

interface MeResponse {
  id?: string;
  full_name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const me = await serverFetch<{ data: MeResponse }>("/v1/admins/profile");
  const data = (me.data as unknown as { data?: MeResponse } | null)?.data;
  const fallbackName =
    [data?.firstName, data?.lastName].filter(Boolean).join(" ").trim() ||
    undefined;
  const name = data?.full_name ?? fallbackName;
  const user = data ? { name, email: data.email } : undefined;

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} />
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
