"use client";

import { Briefcase } from "lucide-react";
import { SidebarNav } from "@/components/layout/SidebarNav";

interface DashboardSidebarProps {
  user?: { name?: string; email?: string };
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-white">
          <Briefcase className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">ATS</p>
          <p className="mt-1 text-xs text-sidebar-muted">Hiring dashboard</p>
        </div>
      </div>

      <SidebarNav />

      <div className="border-t border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-primary text-white text-sm font-medium">
            {(user?.name ?? "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.name ?? "Admin"}
            </p>
            <p className="truncate text-xs text-sidebar-muted">
              {user?.email ?? ""}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
