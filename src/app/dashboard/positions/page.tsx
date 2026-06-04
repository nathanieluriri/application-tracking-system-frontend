import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PositionsPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Positions</h1>
          <p className="text-sm text-muted-foreground">
            Manage open roles and their pipelines.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/positions/new">Add position</Link>
        </Button>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>All positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            List deferred to vertical-slice phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
