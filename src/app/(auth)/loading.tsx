import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Auth-group cold-load skeleton — mirrors the login/signup card shape inside
 * the (auth) layout's centered max-w-md container.
 */
export default function AuthLoading() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <Skeleton className="mx-auto h-6 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
