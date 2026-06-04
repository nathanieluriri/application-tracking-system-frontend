import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton matching the widget builder's shape: header (title + actions)
 * over a two-column config / preview grid. Shared by the route loading.tsx and
 * the builder's own data-fetch state so the layout doesn't shift.
 */
export function WidgetBuilderSkeleton() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4 rounded-lg border p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <div className="space-y-4 rounded-lg border p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  );
}
