import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-1/3" />
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full" style={{ height }} />
      </CardContent>
    </Card>
  );
}
