import { Briefcase } from "lucide-react";
import { Spinner } from "./Spinner";

/**
 * Full-screen branded boot loader for the app shell. Used by the root
 * loading.tsx instead of a bare spinner (a naked full-page spinner reads as
 * "broken"; a branded splash reads as "loading").
 */
export function BrandedSplash() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Briefcase className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium">ATS</p>
        <Spinner size="sm" decorative />
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}
