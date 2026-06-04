import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email templates</h1>
          <p className="text-sm text-muted-foreground">
            Reusable templates synced to Resend.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/templates/new">New template</Link>
        </Button>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
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
