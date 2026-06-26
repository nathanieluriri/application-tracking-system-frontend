"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/layout/NavLink";
import { NAV_ITEMS, type NavItem } from "@/lib/nav/items";

function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) {
    return item.match.some((prefix) => pathname.startsWith(prefix));
  }
  return pathname === item.href;
}

interface SidebarNavProps {
  /**
   * Called when a nav link is activated. The mobile drawer passes a closer here
   * so picking a destination dismisses the sheet; the desktop sidebar omits it.
   */
  onNavigate?: () => void;
}

/**
 * The primary navigation list. Shared by the persistent desktop sidebar
 * (`DashboardSidebar`) and the mobile drawer (`MobileNav`) so both stay in
 * lock-step — add a route to `NAV_ITEMS` and it appears in both.
 */
export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex-1 px-3 py-4 space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item, pathname);
        const Icon = item.icon;
        return (
          <NavLink
            key={item.href}
            href={item.href}
            onNavigate={onNavigate}
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
              active && "bg-secondary text-primary font-medium",
            )}
            aria-current={active ? "page" : undefined}
          >
            {active ? (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-sidebar-primary"
              />
            ) : null}
            <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
