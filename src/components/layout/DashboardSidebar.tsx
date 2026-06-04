"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "@/lib/nav/items";

function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) {
    return item.match.some((prefix) => pathname.startsWith(prefix));
  }
  return pathname === item.href;
}

interface DashboardSidebarProps {
  user?: { name?: string; email?: string };
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname();

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

      <nav aria-label="Primary" className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                "text-sidebar-muted hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
                active &&
                  "bg-sidebar-accent text-sidebar-foreground font-medium",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r bg-sidebar-primary"
                />
              ) : null}
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

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
