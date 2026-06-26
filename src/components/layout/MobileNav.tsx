"use client";

import { useState } from "react";
import { Briefcase, Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/SidebarNav";

/**
 * The mobile navigation drawer. The persistent `DashboardSidebar` is
 * `hidden md:flex`, so below the `md` breakpoint this hamburger + slide-in
 * sheet are the only way to navigate. Picking a link closes the drawer.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="md:hidden inline-flex items-center justify-center rounded-md p-2 hover:bg-muted"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-64 max-w-[80%] flex-col border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetTitle className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5 text-sidebar-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-white">
            <Briefcase className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-sm font-semibold leading-none">ATS</span>
        </SheetTitle>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
