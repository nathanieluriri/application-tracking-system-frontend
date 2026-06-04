export default function WidgetsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="h-7 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted/60" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
