"use client";

import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { AskAiButton } from "@/components/agent/AskAiButton";

interface TopbarProps {
  user?: { name?: string; email?: string };
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Couldn't log out — try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 h-14 flex items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <button
        type="button"
        className="md:hidden inline-flex items-center justify-center rounded-md p-2 hover:bg-muted"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="hidden md:block text-sm text-muted-foreground">
        {user?.email ? `Signed in as ${user.email}` : ""}
      </div>
      <div className="flex items-center gap-2">
        <AskAiButton />
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          disabled={pending}
          aria-busy={pending}
        >
          <LogOut className="h-4 w-4" />
          <span>Log out</span>
        </Button>
      </div>
    </header>
  );
}
