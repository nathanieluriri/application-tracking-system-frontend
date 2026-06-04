import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2">
            <Skeleton className="h-6 w-24" />
            <div className="space-y-2 rounded-lg border bg-muted/30 p-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
