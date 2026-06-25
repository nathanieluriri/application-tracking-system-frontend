"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Shown in place of the dashboard when the current session is not an administrator.
 * The dashboard's data routes are admin-only, so a non-admin session would only
 * see broken/"Page not found" pages. Signing out clears the cookie so the login
 * page won't bounce back (the middleware only redirects authenticated users away
 * from /login), letting the user sign in with an administrator account.
 */
export function AdminRequired() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signInAsAdmin() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      toast.error("Couldn't sign out — try again.");
      setPending(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-4 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold">Administrator access required</h1>
        <p className="text-sm text-muted-foreground">
          The dashboard is for administrators. Sign in with an administrator account to continue.
        </p>
        <Button onClick={signInAsAdmin} disabled={pending} aria-busy={pending}>
          {pending ? "Signing out…" : "Sign in as administrator"}
        </Button>
      </div>
    </div>
  );
}
